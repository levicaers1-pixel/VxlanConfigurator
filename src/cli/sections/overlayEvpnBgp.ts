import type { SectionBuilder } from '../context'
import { LOOPBACK_ID } from './interfaces'

/**
 * Leaf-side EVPN overlay peering used only when underlayProtocol === 'ospf':
 * underlay reachability comes from OSPF, and the l2vpn evpn address-family is
 * peered separately (multihop) between each leaf and every spine.
 *
 * RD/route-target are NOT configured here — see evpnVlans.ts and vrfs.ts.
 */
export const overlayEvpnBgp: SectionBuilder = (ctx, out) => {
  if (ctx.project.settings.underlayProtocol !== 'ospf') return
  if (ctx.project.settings.fabricMode !== 'evpn') return
  if (ctx.self.role === 'spine') return
  const asn = ctx.ipPlan.asns[ctx.self.id]
  const loopback = ctx.ipPlan.loopbacks[ctx.self.id]
  if (asn === undefined || !loopback) return

  const spines = ctx.project.switches.filter((s) => s.role === 'spine')

  out.block(`router bgp ${asn}`, (b) => {
    b.line(`bgp router-id ${loopback}`)
    for (const spine of spines) {
      const spineLoopback = ctx.ipPlan.loopbacks[spine.id]
      const spineAsn = ctx.ipPlan.asns[spine.id]
      if (!spineLoopback || spineAsn === undefined) continue
      b.line(`neighbor ${spineLoopback} remote-as ${spineAsn}`)
      b.line(`neighbor ${spineLoopback} description ${spine.name}`)
      b.line(`neighbor ${spineLoopback} ebgp-multihop 3`)
      b.line(`neighbor ${spineLoopback} update-source loopback ${LOOPBACK_ID}`)
    }
    b.blank()
    b.block('address-family l2vpn evpn', (ab) => {
      for (const spine of spines) {
        const spineLoopback = ctx.ipPlan.loopbacks[spine.id]
        if (!spineLoopback) continue
        ab.line(`neighbor ${spineLoopback} activate`)
        ab.line(`neighbor ${spineLoopback} next-hop-unchanged`)
      }
    })
  })
  out.blank()
}
