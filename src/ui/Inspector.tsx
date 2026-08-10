import { useState } from 'react'
import { MousePointerClick } from 'lucide-react'
import { useProjectStore } from '../store/useProjectStore'
import { useSelectionStore } from '../store/useSelectionStore'
import { getCatalogEntry } from '../domain/catalog'
import { listPorts } from '../domain/ports'
import { checkConnectPorts } from '../canvas/linkValidation'
import type { HostConnection, HostPortMode, Link, LinkKind, SwitchInstance, SwitchRole } from '../domain/types'
import type { IpAllocationResult } from '../domain/types'
import { LINK_KIND_LABEL } from './theme'
import { EmptyState as EmptyStatePrimitive } from './primitives'

const ROLES: SwitchRole[] = ['spine', 'leaf', 'border', 'access', 'standalone']
const LINK_KINDS: LinkKind[] = ['underlay-p2p', 'vsx-isl', 'vsx-keepalive', 'mgmt', 'unassigned']
const inputClass = 'rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100'

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

function freeHostPorts(
  sw: SwitchInstance | undefined,
  links: Link[],
  hostConnections: HostConnection[],
  excludeConnId?: string,
) {
  if (!sw) return []
  const entry = getCatalogEntry(sw.catalogId)
  if (!entry) return []
  const usedFromLinks = links.flatMap((l) => [
    l.a.switchInstanceId === sw.id ? l.a.portName : null,
    l.b.switchInstanceId === sw.id ? l.b.portName : null,
  ])
  const usedFromHosts = hostConnections
    .filter((c) => c.id !== excludeConnId)
    .flatMap((c) => c.ports.filter((p) => p.switchInstanceId === sw.id).map((p) => p.portName))
  const used = new Set([...usedFromLinks, ...usedFromHosts].filter((p): p is string => !!p))
  return listPorts(entry).filter((p) => !used.has(p))
}

function summarizeHostConnection(conn: HostConnection): string {
  if (conn.mode === 'access') return `access vlan ${conn.accessVlanId ?? '?'}`
  const allowed = conn.trunkAllowedVlans
  const allowedText = !allowed || allowed === 'all' ? 'all' : allowed.join(',')
  return `trunk native ${conn.trunkNativeVlanId ?? '-'} allowed ${allowedText}`
}

function HostConnectionsSection({ sw }: { sw: SwitchInstance }) {
  const project = useProjectStore((s) => s.project)
  const addHostConnection = useProjectStore((s) => s.addHostConnection)
  const removeHostConnection = useProjectStore((s) => s.removeHostConnection)

  const [name, setName] = useState('')
  const [ownPort, setOwnPort] = useState('')
  const [dualHome, setDualHome] = useState(false)
  const [partnerPort, setPartnerPort] = useState('')
  const [mode, setMode] = useState<HostPortMode>('access')
  const [accessVlanId, setAccessVlanId] = useState('')
  const [trunkNativeVlanId, setTrunkNativeVlanId] = useState('')
  const [trunkAllowedMode, setTrunkAllowedMode] = useState<'all' | 'list'>('all')
  const [trunkAllowedList, setTrunkAllowedList] = useState('')

  if (!project) return null

  const partner = sw.vsxGroupId
    ? project.switches.find((s) => s.vsxGroupId === sw.vsxGroupId && s.id !== sw.id)
    : undefined

  const ownFree = freeHostPorts(sw, project.links, project.hostConnections)
  const partnerFree = freeHostPorts(partner, project.links, project.hostConnections)

  const connections = project.hostConnections.filter((c) => c.ports.some((p) => p.switchInstanceId === sw.id))

  const canSubmit = name.trim() && ownPort && (!dualHome || (partner && partnerPort))

  const submit = () => {
    if (!canSubmit) return
    const ports = [{ switchInstanceId: sw.id, portName: ownPort }]
    if (dualHome && partner) ports.push({ switchInstanceId: partner.id, portName: partnerPort })
    addHostConnection({
      name: name.trim(),
      ports,
      mode,
      accessVlanId: mode === 'access' && accessVlanId ? Number(accessVlanId) : undefined,
      trunkNativeVlanId: mode === 'trunk' && trunkNativeVlanId ? Number(trunkNativeVlanId) : undefined,
      trunkAllowedVlans:
        mode === 'trunk' && trunkAllowedMode === 'list'
          ? trunkAllowedList
              .split(',')
              .map((v) => Number(v.trim()))
              .filter((v) => Number.isFinite(v) && v > 0)
          : 'all',
    })
    setName('')
    setOwnPort('')
    setDualHome(false)
    setPartnerPort('')
    setAccessVlanId('')
    setTrunkNativeVlanId('')
    setTrunkAllowedList('')
  }

  return (
    <div className="border-t border-slate-800 pt-2">
      <span className="text-xs text-slate-400">Host / server connections</span>

      {connections.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1">
          {connections.map((conn) => (
            <li key={conn.id} className="rounded bg-slate-900/60 px-2 py-1 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-200">{conn.name}</span>
                <button className="text-rose-400 hover:text-rose-300" onClick={() => removeHostConnection(conn.id)}>
                  ×
                </button>
              </div>
              <div className="text-[10px] text-slate-500">
                {conn.ports
                  .map((p) => `${project.switches.find((s) => s.id === p.switchInstanceId)?.name ?? '?'}:${p.portName}`)
                  .join(' + ')}
                {conn.ports.length === 2 ? ' (MC-LAG)' : ''} · {summarizeHostConnection(conn)}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-col gap-1.5 rounded border border-slate-800 bg-slate-950/40 p-2">
        <input
          className={inputClass}
          placeholder="Name (e.g. esxi-host-01)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-500">Port on {sw.name}</span>
          <select className={inputClass} value={ownPort} onChange={(e) => setOwnPort(e.target.value)}>
            <option value="" disabled>
              Select port…
            </option>
            {ownFree.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        {partner && (
          <label className="flex items-center gap-2 text-[10px] text-slate-400">
            <input type="checkbox" checked={dualHome} onChange={(e) => setDualHome(e.target.checked)} />
            Dual-home via MC-LAG to VSX partner ({partner.name})
          </label>
        )}
        {dualHome && partner && (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">Port on {partner.name}</span>
            <select className={inputClass} value={partnerPort} onChange={(e) => setPartnerPort(e.target.value)}>
              <option value="" disabled>
                Select port…
              </option>
              {partnerFree.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-500">Mode</span>
          <select className={inputClass} value={mode} onChange={(e) => setMode(e.target.value as HostPortMode)}>
            <option value="access">Access</option>
            <option value="trunk">Trunk</option>
          </select>
        </label>

        {mode === 'access' ? (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">Access VLAN ID</span>
            <input
              type="number"
              className={inputClass}
              value={accessVlanId}
              onChange={(e) => setAccessVlanId(e.target.value)}
            />
          </label>
        ) : (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-500">Native VLAN ID (optional)</span>
              <input
                type="number"
                className={inputClass}
                value={trunkNativeVlanId}
                onChange={(e) => setTrunkNativeVlanId(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-500">Allowed VLANs</span>
              <select
                className={inputClass}
                value={trunkAllowedMode}
                onChange={(e) => setTrunkAllowedMode(e.target.value as 'all' | 'list')}
              >
                <option value="all">All</option>
                <option value="list">Specific list</option>
              </select>
            </label>
            {trunkAllowedMode === 'list' && (
              <input
                className={inputClass}
                placeholder="e.g. 10,20,30"
                value={trunkAllowedList}
                onChange={(e) => setTrunkAllowedList(e.target.value)}
              />
            )}
          </>
        )}

        <button
          className="mt-1 rounded border border-sky-800 bg-sky-950/50 px-2 py-1 text-xs text-sky-200 hover:bg-sky-950 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canSubmit}
          onClick={submit}
        >
          Add connection
        </button>
      </div>
    </div>
  )
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
    const mgmtIp = ipPlan?.mgmtIps[sw.id]

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

        {(loopback || mgmtIp) && (
          <div className="rounded border border-slate-800 bg-slate-900/60 p-2 text-xs text-slate-300">
            {loopback && <div>Loopback: {loopback}</div>}
            {asn && <div>ASN: {asn}</div>}
            {mgmtIp && <div>Mgmt IP: {mgmtIp}</div>}
          </div>
        )}

        <div className="border-t border-slate-800 pt-2">
          <span className="text-xs text-slate-400">Management IP override</span>
          <p className="mb-1 mt-0.5 text-[10px] text-slate-600">
            Auto-allocated from the mgmt pool by default. Enter one (with prefix, e.g. 10.0.0.5/24) to pin it manually.
          </p>
          <input
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
            placeholder={mgmtIp ?? 'auto'}
            value={sw.managementIp ?? ''}
            onChange={(e) => updateSwitch(sw.id, { managementIp: e.target.value || undefined })}
          />
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
            placeholder={`gateway (default ${ipPlan?.mgmtGateway ?? 'auto'})`}
            value={sw.managementGateway ?? ''}
            onChange={(e) => updateSwitch(sw.id, { managementGateway: e.target.value || undefined })}
          />
        </div>

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

        {sw.role !== 'access' && !(project.settings.fabricMode === 'evpn' && sw.role === 'spine') && (
          <HostConnectionsSection sw={sw} />
        )}

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
