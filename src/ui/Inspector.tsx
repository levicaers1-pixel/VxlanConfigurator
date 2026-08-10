import { MousePointerClick } from 'lucide-react'
import { useProjectStore } from '../store/useProjectStore'
import { useSelectionStore } from '../store/useSelectionStore'
import { getCatalogEntry } from '../domain/catalog'
import { listPorts } from '../domain/ports'
import { checkConnectPorts } from '../canvas/linkValidation'
import type { Link, LinkKind, SwitchInstance, SwitchRole } from '../domain/types'
import type { IpAllocationResult } from '../domain/types'
import { LINK_KIND_LABEL } from './theme'
import { EmptyState as EmptyStatePrimitive } from './primitives'

const ROLES: SwitchRole[] = ['spine', 'leaf', 'border', 'standalone']
const LINK_KINDS: LinkKind[] = ['underlay-p2p', 'vsx-isl', 'vsx-keepalive', 'mgmt', 'unassigned']

function portOptions(sw: SwitchInstance | undefined, links: Link[], currentPort: string, excludeLinkId: string) {
  if (!sw) return []
  const entry = getCatalogEntry(sw.catalogId)
  if (!entry) return []
  const used = new Set(
    links
      .filter((l) => l.id !== excludeLinkId)
      .flatMap((l) => [
        l.a.switchInstanceId === sw.id ? l.a.portName : null,
        l.b.switchInstanceId === sw.id ? l.b.portName : null,
      ])
      .filter((p): p is string => !!p),
  )
  return listPorts(entry).map((port) => ({ port, disabled: used.has(port) && port !== currentPort }))
}

export function Inspector({ ipPlan }: { ipPlan: IpAllocationResult | null }) {
  const project = useProjectStore((s) => s.project)
  const updateSwitch = useProjectStore((s) => s.updateSwitch)
  const removeSwitch = useProjectStore((s) => s.removeSwitch)
  const duplicateSwitch = useProjectStore((s) => s.duplicateSwitch)
  const setVsxPair = useProjectStore((s) => s.setVsxPair)
  const clearVsxPair = useProjectStore((s) => s.clearVsxPair)
  const updateLink = useProjectStore((s) => s.updateLink)
  const removeLink = useProjectStore((s) => s.removeLink)
  const selectedNodeId = useSelectionStore((s) => s.selectedNodeId)
  const selectedEdgeId = useSelectionStore((s) => s.selectedEdgeId)
  const selectNode = useSelectionStore((s) => s.selectNode)

  if (!project) return null

  if (selectedNodeId) {
    const sw = project.switches.find((s) => s.id === selectedNodeId)
    if (!sw) return <EmptyState />
    const entry = getCatalogEntry(sw.catalogId)
    const otherSwitches = project.switches.filter((s) => s.id !== sw.id && !s.vsxGroupId)
    const loopback = ipPlan?.loopbacks[sw.id]
    const asn = ipPlan?.asns[sw.id]

    return (
      <div className="flex flex-col gap-3 p-3 text-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Switch</h3>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Name</span>
          <input
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
            value={sw.name}
            onChange={(e) => updateSwitch(sw.id, { name: e.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Role</span>
          <select
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
            value={sw.role}
            onChange={(e) => updateSwitch(sw.id, { role: e.target.value as SwitchRole })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <div className="text-xs text-slate-500">
          Model: {entry?.model ?? sw.catalogId}
          <br />
          VSX capable: {entry?.supportsVsx ? 'yes' : 'no'}
        </div>

        {loopback && (
          <div className="rounded border border-slate-800 bg-slate-900/60 p-2 text-xs text-slate-300">
            <div>Loopback: {loopback}</div>
            {asn && <div>ASN: {asn}</div>}
          </div>
        )}

        <div className="border-t border-slate-800 pt-2">
          <span className="text-xs text-slate-400">VSX pairing</span>
          {sw.vsxGroupId ? (
            <button
              className="mt-1 w-full rounded border border-rose-800 bg-rose-950/40 px-2 py-1 text-xs text-rose-200 hover:bg-rose-950"
              onClick={() => clearVsxPair(sw.id)}
            >
              Unpair VSX
            </button>
          ) : (
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) setVsxPair(sw.id, e.target.value)
              }}
            >
              <option value="" disabled>
                Pair with…
              </option>
              {otherSwitches.map((other) => (
                <option key={other.id} value={other.id}>
                  {other.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex gap-2">
          <button
            className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
            onClick={() => {
              const newId = duplicateSwitch(sw.id)
              if (newId) selectNode(newId)
            }}
          >
            Duplicate
          </button>
          <button
            className="flex-1 rounded border border-rose-900 bg-rose-950/30 px-2 py-1 text-xs text-rose-300 hover:bg-rose-950/60"
            onClick={() => removeSwitch(sw.id)}
          >
            Delete switch
          </button>
        </div>
      </div>
    )
  }

  if (selectedEdgeId) {
    const link = project.links.find((l) => l.id === selectedEdgeId)
    if (!link) return <EmptyState />
    const switchA = project.switches.find((s) => s.id === link.a.switchInstanceId)
    const switchB = project.switches.find((s) => s.id === link.b.switchInstanceId)
    const ip = ipPlan?.underlayLinkIps[link.id]

    const optionsA = portOptions(switchA, project.links, link.a.portName, link.id)
    const optionsB = portOptions(switchB, project.links, link.b.portName, link.id)

    const tryUpdatePort = (side: 'a' | 'b', newPort: string) => {
      if (!switchA || !switchB) return
      const portA = side === 'a' ? newPort : link.a.portName
      const portB = side === 'b' ? newPort : link.b.portName
      const check = checkConnectPorts(switchA, portA, switchB, portB, project.links, link.id)
      if (!check.ok) {
        window.alert(check.reason)
        return
      }
      updateLink(link.id, { a: { ...link.a, portName: portA }, b: { ...link.b, portName: portB } })
    }

    return (
      <div className="flex flex-col gap-3 p-3 text-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Link</h3>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="truncate text-xs text-slate-400">{switchA?.name ?? '?'} port</span>
            <select
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
              value={link.a.portName}
              onChange={(e) => tryUpdatePort('a', e.target.value)}
            >
              {optionsA.map(({ port, disabled }) => (
                <option key={port} value={port} disabled={disabled}>
                  {port}
                  {disabled ? ' (in use)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="truncate text-xs text-slate-400">{switchB?.name ?? '?'} port</span>
            <select
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
              value={link.b.portName}
              onChange={(e) => tryUpdatePort('b', e.target.value)}
            >
              {optionsB.map(({ port, disabled }) => (
                <option key={port} value={port} disabled={disabled}>
                  {port}
                  {disabled ? ' (in use)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="-mt-1 text-[10px] text-slate-600">
          Tip: you can also drag either end of this link on the canvas to rewire it to a different port or switch.
        </p>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Kind</span>
          <select
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
            value={link.kind}
            onChange={(e) => updateLink(link.id, { kind: e.target.value as LinkKind })}
          >
            {LINK_KINDS.map((k) => (
              <option key={k} value={k}>
                {LINK_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>

        {ip && (
          <div className="rounded border border-slate-800 bg-slate-900/60 p-2 text-xs text-slate-300">
            {switchA?.name}: {ip.aIp}/{ip.prefixLen}
            <br />
            {switchB?.name}: {ip.bIp}/{ip.prefixLen}
          </div>
        )}

        <button
          className="mt-2 rounded border border-rose-900 bg-rose-950/30 px-2 py-1 text-xs text-rose-300 hover:bg-rose-950/60"
          onClick={() => removeLink(link.id)}
        >
          Delete link
        </button>
      </div>
    )
  }

  return <EmptyState />
}

function EmptyState() {
  return (
    <EmptyStatePrimitive
      icon={<MousePointerClick size={22} />}
      title="Nothing selected"
      hint="Click a switch or link on the canvas to edit it here."
    />
  )
}
