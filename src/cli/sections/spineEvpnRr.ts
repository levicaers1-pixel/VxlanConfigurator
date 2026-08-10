import type { SectionBuilder } from '../context'

/**
 * Spine-side EVPN route-reflector peering used only when underlayProtocol
 * === 'ospf': the spine relays EVPN routes between leaves over loopback
 * sessions since it has no VNIs/VLANs of its own.
 */
export const spineEvpnRouteReflector: SectionBuilder = (ctx, out) => {
  if (ctx.project.settings.underlayProtocol !== 'ospf') return
  if (ctx.project.settings.fabricMode !== 'evpn') return
  if (ctx.self.role !== 'spine') return
  const asn = ctx.ipPlan.asns[ctx.self.id]
  const loopback = ctx.ipPlan.loopbacks[ctx.self.id]
  if (asn === undefined || !loopback) return

  const leaves = ctx.project.switches.filter((s) => s.role === 'leaf')

  out.block(`router bgp ${asn}`, (b) => {
    b.line(`bgp router-id ${loopback}`)
    for (const leaf of leaves) {
      const leafLoopback = ctx.ipPlan.loopbacks[leaf.id]
      const leafAsn = ctx.ipPlan.asns[leaf.id]
      if (!leafLoopback || leafAsn === undefined) continue
      b.line(`neighbor ${leafLoopback} remote-as ${leafAsn}`)
      b.line(`neighbor ${leafLoopback} description ${leaf.name}`)
      b.line(`neighbor ${leafLoopback} ebgp-multihop 3`)
      b.line(`neighbor ${leafLoopback} update-source loopback 0`)
    }
    b.blank()
    b.block('address-family l2vpn evpn', (ab) => {
      for (const leaf of leaves) {
        const leafLoopback = ctx.ipPlan.loopbacks[leaf.id]
        if (!leafLoopback) continue
        ab.line(`neighbor ${leafLoopback} activate`)
        ab.line(`neighbor ${leafLoopback} route-reflector-client`)
      }
    })
  })
  out.blank()
}
