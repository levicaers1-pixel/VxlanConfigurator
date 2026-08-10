import { Waypoints } from 'lucide-react'
import { useProjectStore } from '../store/useProjectStore'
import type { IpAllocationResult } from '../domain/types'
import { EmptyState } from './primitives'

function Table({ title, rows }: { title: string; rows: [string, string][] }) {
  if (rows.length === 0) return null
  return (
    <div className="mb-4">
      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <table className="w-full text-xs">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-slate-800/60">
              <td className="py-1 pr-2 text-slate-400">{k}</td>
              <td className="py-1 font-mono text-slate-200">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function IpPlanPanel({ ipPlan }: { ipPlan: IpAllocationResult | null }) {
  const project = useProjectStore((s) => s.project)
  if (!project || !ipPlan)
    return <EmptyState icon={<Waypoints size={22} />} title="No topology yet" hint="The IP plan fills in live as you add switches and links." />

  const switchesById = new Map(project.switches.map((s) => [s.id, s]))
  const linksById = new Map(project.links.map((l) => [l.id, l]))
  const vlansById = new Map(project.vlans.map((v) => [v.id, v]))
  const vrfsById = new Map(project.vrfs.map((v) => [v.id, v]))

  const loopbackRows: [string, string][] = Object.entries(ipPlan.loopbacks).map(([id, ip]) => [
    switchesById.get(id)?.name ?? id,
    `${ip}/32`,
  ])

  const mgmtRows: [string, string][] = Object.entries(ipPlan.mgmtIps).map(([id, ip]) => [
    switchesById.get(id)?.name ?? id,
    ip,
  ])

  const asnRows: [string, string][] = Object.entries(ipPlan.asns).map(([id, asn]) => [
    switchesById.get(id)?.name ?? id,
    String(asn),
  ])

  const underlayRows: [string, string][] = Object.entries(ipPlan.underlayLinkIps).map(([id, ip]) => {
    const link = linksById.get(id)
    const a = link && switchesById.get(link.a.switchInstanceId)?.name
    const b = link && switchesById.get(link.b.switchInstanceId)?.name
    return [`${a ?? '?'} ↔ ${b ?? '?'}`, `${ip.aIp} – ${ip.bIp} /${ip.prefixLen}`]
  })

  const vsxRows: [string, string][] = Object.entries(ipPlan.vsxKeepalives).map(([groupId, kv]) => [
    `${switchesById.get(kv.primarySwitchId)?.name ?? '?'} ↔ ${switchesById.get(kv.secondarySwitchId)?.name ?? '?'}`,
    `${kv.primaryIp} – ${kv.secondaryIp} /31 (${groupId.slice(0, 8)})`,
  ])

  const subnetRows: [string, string][] = Object.entries(ipPlan.tenantSubnets).map(([id, cidr]) => [
    vlansById.get(id)?.name ?? id,
    cidr,
  ])

  const l2VniRows: [string, string][] = Object.entries(ipPlan.l2Vnis).map(([id, vni]) => {
    const vlan = vlansById.get(id)
    return [`VLAN ${vlan?.vlanId ?? '?'} (${vlan?.name ?? id})`, String(vni)]
  })

  const l3VniRows: [string, string][] = Object.entries(ipPlan.l3Vnis).map(([id, vni]) => [
    vrfsById.get(id)?.name ?? id,
    String(vni),
  ])

  return (
    <div className="overflow-y-auto p-3">
      <Table title="Loopbacks" rows={loopbackRows} />
      <Table title="Management IPs" rows={mgmtRows} />
      <Table title="ASNs" rows={asnRows} />
      <Table title="Underlay links" rows={underlayRows} />
      <Table title="VSX keepalive" rows={vsxRows} />
      <Table title="Tenant subnets" rows={subnetRows} />
      <Table title="L2 VNIs" rows={l2VniRows} />
      <Table title="L3 VNIs" rows={l3VniRows} />
      {project.switches.length === 0 && (
        <EmptyState
          icon={<Waypoints size={22} />}
          title="No switches yet"
          hint="Add switches and links on the canvas to populate the IP plan."
        />
      )}
    </div>
  )
}
