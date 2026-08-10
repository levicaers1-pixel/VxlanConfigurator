import type { SectionBuilder } from '../context'
import { vrfsOnSwitch } from '../context'

function sortedVrfIndex(ctx: Parameters<SectionBuilder>[0], vrfId: string): number {
  const sorted = [...ctx.project.vrfs].sort((a, b) => a.name.localeCompare(b.name))
  return sorted.findIndex((v) => v.id === vrfId) + 1
}

/**
 * Leaf-side EVPN overlay peering used only when underlayProtocol === 'ospf':
 * underlay reachability comes from OSPF, and the l2vpn evpn address-family is
 * peered separately (multihop) between each leaf and every spine.
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
      b.line(`neighbor ${spineLoopback} update-source loopback 0`)
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
    for (const vrf of vrfsOnSwitch(ctx)) {
      b.blank()
      b.block(`vrf ${vrf.name}`, (vb) => {
        vb.block('address-family l2vpn evpn', (ab) => {
          ab.line('route-target both auto')
          ab.line(`route-distinguisher ${loopback}:${sortedVrfIndex(ctx, vrf.id)}`)
        })
      })
    }
  })
  out.blank()
}
