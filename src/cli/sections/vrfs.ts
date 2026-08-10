import type { SectionBuilder } from '../context'
import { vrfIndex, vrfsOnSwitch } from '../context'

/**
 * Per Aruba AOS-CX docs (config-vrf / IVRL commands, 8320/8325 CLI Bank):
 * RD lives directly in the `vrf <name>` context (`rd <AS-NUMBER:NN>`, no
 * "auto" option there), and import/export route-targets live one level
 * deeper under `address-family ipv4 unicast`. This is the L3VNI/VRF side of
 * EVPN route identity — separate from the per-VLAN L2VNI RD/RT, which lives
 * under the `evpn` context instead (see evpnVlans.ts).
 */
export const vrfs: SectionBuilder = (ctx, out) => {
  if (ctx.self.role === 'spine') return
  const asn = ctx.ipPlan.asns[ctx.self.id]
  for (const vrf of vrfsOnSwitch(ctx)) {
    const adminNumber = `${asn ?? ctx.project.settings.baseAsn}:${vrfIndex(ctx, vrf.id)}`
    out.block(`vrf ${vrf.name}`, (b) => {
      // RD/RT are BGP EVPN route-identity concepts — static VXLAN mode has no
      // BGP EVPN control plane, so the VRF context needs nothing beyond creation.
      if (ctx.project.settings.fabricMode !== 'evpn') return
      b.line(`rd ${vrf.routeDistinguisherOverride ?? adminNumber}`)
      b.block('address-family ipv4 unicast', (ab) => {
        for (const rt of vrf.exportRouteTargets ?? [adminNumber]) ab.line(`route-target export ${rt}`)
        for (const rt of vrf.importRouteTargets ?? [adminNumber]) ab.line(`route-target import ${rt}`)
      })
      b.line('exit-address-family')
    })
  }
  if (vrfsOnSwitch(ctx).length > 0) out.blank()
}
