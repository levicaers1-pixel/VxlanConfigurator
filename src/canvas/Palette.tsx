import { useState } from 'react'
import { PanelLeftClose, PanelLeftOpen, Server } from 'lucide-react'
import { SWITCH_CATALOG } from '../domain/catalog'
import { useProjectStore } from '../store/useProjectStore'
import type { SwitchCatalogEntry } from '../domain/types'
import { SPEED_COLOR } from '../ui/theme'

export const DRAG_MIME = 'application/vxlan-switch'

function CatalogCard({ entry }: { entry: SwitchCatalogEntry }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ catalogId: entry.id, role: entry.suitableRoles[0] }))
        e.dataTransfer.effectAllowed = 'move'
      }}
      className="cursor-grab rounded-lg border border-slate-800 bg-slate-900/80 p-2.5 text-xs transition-colors hover:border-slate-600 hover:bg-slate-900 active:cursor-grabbing"
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold text-slate-200">{entry.model}</div>
        <span className="text-[10px] text-slate-600">{entry.series}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {entry.suitableRoles.map((r) => (
          <span
            key={r}
            className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-400"
          >
            {r}
          </span>
        ))}
        {entry.supportsVsx && (
          <span className="rounded-full bg-pink-950/60 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-pink-300/80">
            VSX
          </span>
        )}
        {entry.custom && (
          <span className="rounded-full bg-amber-950/60 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-300/80">
            unverified
          </span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {entry.portGroups.map((g, i) => (
          <span key={i} className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SPEED_COLOR[g.speedGbps] }} />
            {g.count}× {g.speedGbps}G
          </span>
        ))}
      </div>
    </div>
  )
}

export function Palette() {
  const [collapsed, setCollapsed] = useState(false)
  const customCatalogEntries = useProjectStore((s) => s.project?.customCatalogEntries ?? [])

  if (collapsed) {
    return (
      <div className="flex h-full w-11 flex-col items-center border-r border-slate-800 bg-slate-950/60 py-3">
        <button
          onClick={() => setCollapsed(false)}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          title="Show switch catalog"
        >
          <PanelLeftOpen size={16} />
        </button>
        <Server size={16} className="mt-4 text-slate-700" />
      </div>
    )
  }

  return (
    <div className="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-800 bg-slate-950/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-300">Switch catalog</h2>
        <button
          onClick={() => setCollapsed(true)}
          className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
          title="Hide catalog"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>
      <p className="mb-3 text-[11px] text-slate-500">Drag a model onto the canvas to place it.</p>
      <div className="flex flex-col gap-2">
        {SWITCH_CATALOG.map((entry) => (
          <CatalogCard key={entry.id} entry={entry} />
        ))}
      </div>

      {customCatalogEntries.length > 0 && (
        <>
          <h2 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-300">
            Custom (this project)
          </h2>
          <p className="mb-3 text-[10px] text-slate-600">
            Added from an import for models not in the shipped catalog — port layout is a rough guess, verify before
            trusting generated CLI.
          </p>
          <div className="flex flex-col gap-2">
            {customCatalogEntries.map((entry) => (
              <CatalogCard key={entry.id} entry={entry} />
            ))}
          </div>
        </>
      )}

      <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
        The dropped role defaults to the model&apos;s primary use — change it anytime in the Inspector.
      </p>
    </div>
  )
}
