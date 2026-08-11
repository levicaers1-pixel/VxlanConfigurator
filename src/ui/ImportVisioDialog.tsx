import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, X } from 'lucide-react'
import { useProjectStore } from '../store/useProjectStore'
import { SWITCH_CATALOG, getCatalogEntry } from '../domain/catalog'
import { nextAvailablePort } from '../domain/ports'
import { parseVsdxFile } from '../import/visio/parseVsdx'
import { deriveDeviceName, deriveModelName, matchShapeToCatalog, synthesizeCatalogEntry } from '../import/visio/matchCatalog'
import type { SwitchCatalogEntry, SwitchRole } from '../domain/types'
import { Button, inputClass } from './primitives'

const ROLES: SwitchRole[] = ['spine', 'leaf', 'border', 'access', 'standalone']
const PX_PER_INCH = 110

interface ReviewShape {
  visioId: string
  label: string
  xIn: number
  yIn: number
  include: boolean
  catalogId: string
  role: SwitchRole
  name: string
  confidence: 'high' | 'low'
}

interface ReviewConnector {
  visioId: string
  fromVisioId: string
  toVisioId: string
  include: boolean
}

type Stage = 'idle' | 'error' | 'review'

export function ImportVisioDialog({ trigger }: { trigger: React.ReactNode }) {
  const addSwitch = useProjectStore((s) => s.addSwitch)
  const updateSwitch = useProjectStore((s) => s.updateSwitch)
  const addLink = useProjectStore((s) => s.addLink)
  const addCustomCatalogEntries = useProjectStore((s) => s.addCustomCatalogEntries)
  const projectCustomEntries = useProjectStore((s) => s.project?.customCatalogEntries ?? [])

  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [shapes, setShapes] = useState<ReviewShape[]>([])
  const [connectors, setConnectors] = useState<ReviewConnector[]>([])
  const [newCustomEntries, setNewCustomEntries] = useState<SwitchCatalogEntry[]>([])
  const [pageHeightIn, setPageHeightIn] = useState(8.5)
  const [summary, setSummary] = useState<string | null>(null)

  function reset() {
    setStage('idle')
    setError(null)
    setTruncated(false)
    setShapes([])
    setConnectors([])
    setNewCustomEntries([])
    setSummary(null)
  }

  async function handleFile(file: File) {
    reset()
    try {
      const buffer = await file.arrayBuffer()
      const diagram = await parseVsdxFile(buffer)

      // Unmatched shapes get a project-local catalog entry synthesized from
      // their label — grouped by SKU (or, failing that, the cleaned model
      // text) so every instance of the same real-world model shares ONE
      // entry instead of collapsing into an arbitrary unrelated default or
      // fragmenting into one entry per shape.
      const synthesized = new Map<string, SwitchCatalogEntry>()

      const reviewShapes: ReviewShape[] = diagram.shapes.map((shape) => {
        const match = matchShapeToCatalog(shape.label)
        let catalogId: string
        if (match.entry) {
          catalogId = match.entry.id
        } else {
          const groupKey = shape.sku ?? (deriveModelName(shape.label).toUpperCase() || shape.label)
          let entry = synthesized.get(groupKey)
          if (!entry) {
            entry = synthesizeCatalogEntry(shape.label, shape.sku, match.role)
            synthesized.set(groupKey, entry)
          }
          catalogId = entry.id
        }
        const name = deriveDeviceName(shape.label, match.entry) ?? ''
        return {
          visioId: shape.id,
          label: shape.label || '(unlabeled shape)',
          xIn: shape.xIn,
          yIn: shape.yIn,
          include: true,
          catalogId,
          role: match.role,
          name,
          confidence: match.confidence,
        }
      })
      const reviewConnectors: ReviewConnector[] = diagram.connectors
        .filter((c) => reviewShapes.some((s) => s.visioId === c.fromShapeId) && reviewShapes.some((s) => s.visioId === c.toShapeId))
        .map((c) => ({ visioId: c.id, fromVisioId: c.fromShapeId, toVisioId: c.toShapeId, include: true }))

      setShapes(reviewShapes)
      setConnectors(reviewConnectors)
      setNewCustomEntries([...synthesized.values()])
      setPageHeightIn(diagram.pageHeightIn)
      setTruncated(diagram.truncatedToFirstPage)
      setStage('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read this file.')
      setStage('error')
    }
  }

  function shapeLabel(visioId: string): string {
    return shapes.find((s) => s.visioId === visioId)?.label.split('\n')[0] ?? `shape ${visioId}`
  }

  function commitImport() {
    const included = shapes.filter((s) => s.include)
    const idMap = new Map<string, string>()
    const usedPorts = new Map<string, Set<string>>()
    // The review table lets the user reassign a shape to any built-in OR
    // newly-synthesized entry, so port lookups must see both.
    const lookupEntries = [...projectCustomEntries, ...newCustomEntries]

    if (newCustomEntries.length > 0) addCustomCatalogEntries(newCustomEntries)

    for (const shape of included) {
      const xPx = shape.xIn * PX_PER_INCH
      const yPx = (pageHeightIn - shape.yIn) * PX_PER_INCH
      const newId = addSwitch(shape.catalogId, shape.role, { x: xPx, y: yPx })
      idMap.set(shape.visioId, newId)
      usedPorts.set(newId, new Set())
      if (shape.name.trim()) updateSwitch(newId, { name: shape.name.trim() })
    }

    let linksCreated = 0
    let linksSkipped = 0
    for (const conn of connectors) {
      if (!conn.include) continue
      const aId = idMap.get(conn.fromVisioId)
      const bId = idMap.get(conn.toVisioId)
      if (!aId || !bId) {
        linksSkipped += 1
        continue
      }
      const aShape = included.find((s) => idMap.get(s.visioId) === aId)!
      const bShape = included.find((s) => idMap.get(s.visioId) === bId)!
      const aEntry = getCatalogEntry(aShape.catalogId, lookupEntries)
      const bEntry = getCatalogEntry(bShape.catalogId, lookupEntries)
      const aPort = aEntry && nextAvailablePort(aEntry, usedPorts.get(aId)!)
      const bPort = bEntry && nextAvailablePort(bEntry, usedPorts.get(bId)!)
      if (!aPort || !bPort) {
        linksSkipped += 1
        continue
      }
      usedPorts.get(aId)!.add(aPort)
      usedPorts.get(bId)!.add(bPort)
      addLink({ switchInstanceId: aId, portName: aPort }, { switchInstanceId: bId, portName: bPort }, 'unassigned')
      linksCreated += 1
    }

    const newEntriesUsed = newCustomEntries.filter((e) => included.some((s) => s.catalogId === e.id))
    setSummary(
      `Imported ${included.length} switch${included.length === 1 ? '' : 'es'} and ${linksCreated} link${linksCreated === 1 ? '' : 's'}.` +
        (linksSkipped > 0 ? ` ${linksSkipped} link${linksSkipped === 1 ? '' : 's'} skipped (excluded endpoint or switch out of ports).` : '') +
        (newEntriesUsed.length > 0
          ? ` Added ${newEntriesUsed.length} new catalog ${newEntriesUsed.length === 1 ? 'entry' : 'entries'} for models not in the shipped catalog — their port layout is a rough guess, verify before trusting generated CLI.`
          : '') +
        ' Every imported link is set to "Unassigned" — set the real kind (underlay, VSX ISL, etc.) per link in the Inspector.',
    )
    setStage('idle')
    setShapes([])
    setConnectors([])
    setNewCustomEntries([])
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(880px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-5 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold text-slate-100">Import from Visio (.vsdx)</Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {summary && (
            <div className="mb-3 rounded border border-emerald-900 bg-emerald-950/40 p-2 text-xs text-emerald-200">{summary}</div>
          )}

          {stage === 'idle' && <FilePicker onFile={handleFile} />}

          {stage === 'error' && error && (
            <div className="flex items-start gap-2 rounded border border-rose-900 bg-rose-950/40 p-3 text-xs text-rose-200">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Couldn&apos;t read this file.</p>
                <p className="mt-1 text-rose-300/80">{error}</p>
              </div>
            </div>
          )}

          {stage === 'review' && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-slate-500">
                Best-effort extraction from shape labels — nothing is imported until you confirm below. Fix any
                wrong model/role guesses, and uncheck anything that isn&apos;t really a switch or link.
              </p>
              {truncated && (
                <p className="rounded border border-amber-900 bg-amber-950/30 p-2 text-xs text-amber-200">
                  This file has multiple pages — only the first page was parsed.
                </p>
              )}

              <div>
                <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Switches ({shapes.filter((s) => s.include).length} of {shapes.length})
                </h4>
                <div className="flex flex-col gap-1.5">
                  {shapes.map((shape) => (
                    <div
                      key={shape.visioId}
                      className={`flex items-center gap-2 rounded border border-slate-800 bg-slate-900/50 p-2 ${shape.include ? '' : 'opacity-40'}`}
                    >
                      <input
                        type="checkbox"
                        checked={shape.include}
                        onChange={(e) =>
                          setShapes((prev) =>
                            prev.map((s) => (s.visioId === shape.visioId ? { ...s, include: e.target.checked } : s)),
                          )
                        }
                      />
                      <span
                        className="w-40 shrink-0 truncate text-xs text-slate-400"
                        title={shape.label}
                      >
                        {shape.label.split('\n').join(' · ') || '(unlabeled)'}
                      </span>
                      <input
                        className={`${inputClass} w-32 shrink-0`}
                        value={shape.name}
                        placeholder="name"
                        onChange={(e) =>
                          setShapes((prev) =>
                            prev.map((s) => (s.visioId === shape.visioId ? { ...s, name: e.target.value } : s)),
                          )
                        }
                      />
                      <select
                        className={`${inputClass} flex-1`}
                        value={shape.catalogId}
                        onChange={(e) =>
                          setShapes((prev) =>
                            prev.map((s) => (s.visioId === shape.visioId ? { ...s, catalogId: e.target.value } : s)),
                          )
                        }
                      >
                        <optgroup label="Shipped catalog">
                          {SWITCH_CATALOG.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.model}
                            </option>
                          ))}
                        </optgroup>
                        {(projectCustomEntries.length > 0 || newCustomEntries.length > 0) && (
                          <optgroup label="Custom (unverified)">
                            {[...projectCustomEntries, ...newCustomEntries]
                              .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i)
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.model}
                                </option>
                              ))}
                          </optgroup>
                        )}
                      </select>
                      <select
                        className={`${inputClass} w-28 shrink-0`}
                        value={shape.role}
                        onChange={(e) =>
                          setShapes((prev) =>
                            prev.map((s) => (s.visioId === shape.visioId ? { ...s, role: e.target.value as SwitchRole } : s)),
                          )
                        }
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      {shape.confidence === 'low' && (
                        <span className="shrink-0 text-[10px] text-amber-400" title="No confident model match — verify this.">
                          unsure
                        </span>
                      )}
                    </div>
                  ))}
                  {shapes.length === 0 && <p className="text-xs text-slate-600">No shapes found on the first page.</p>}
                </div>
              </div>

              <div>
                <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Links ({connectors.filter((c) => c.include).length} of {connectors.length})
                </h4>
                <div className="flex flex-col gap-1.5">
                  {connectors.map((conn) => (
                    <label
                      key={conn.visioId}
                      className={`flex items-center gap-2 rounded border border-slate-800 bg-slate-900/50 p-2 text-xs text-slate-300 ${conn.include ? '' : 'opacity-40'}`}
                    >
                      <input
                        type="checkbox"
                        checked={conn.include}
                        onChange={(e) =>
                          setConnectors((prev) =>
                            prev.map((c) => (c.visioId === conn.visioId ? { ...c, include: e.target.checked } : c)),
                          )
                        }
                      />
                      {shapeLabel(conn.fromVisioId)} <span className="text-slate-600">↔</span> {shapeLabel(conn.toVisioId)}
                    </label>
                  ))}
                  {connectors.length === 0 && <p className="text-xs text-slate-600">No connections found between shapes.</p>}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
                <Dialog.Close asChild>
                  <Button variant="ghost">Cancel</Button>
                </Dialog.Close>
                <Button
                  variant="primary"
                  disabled={shapes.filter((s) => s.include).length === 0}
                  onClick={commitImport}
                >
                  Import {shapes.filter((s) => s.include).length} switch
                  {shapes.filter((s) => s.include).length === 1 ? '' : 'es'}
                </Button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function FilePicker({ onFile }: { onFile: (file: File) => void }) {
  return (
    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center hover:border-sky-600 hover:bg-slate-900">
      <span className="text-xs text-slate-400">Choose a .vsdx file exported from Visio 2013 or later</span>
      <span className="text-[10px] text-slate-600">
        Only the first page is read. Shapes are matched to the switch catalog by their label text — review the
        result before importing.
      </span>
      <input
        type="file"
        accept=".vsdx,application/vnd.ms-visio.drawing.main+xml,application/vnd.ms-visio.drawing"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onFile(file)
        }}
      />
    </label>
  )
}
