import type { SectionBuilder } from '../context'
import { vlansOnSwitch, vrfsOnSwitch } from '../context'

export const overlayEvpn: SectionBuilder = (ctx, out) => {
  if (ctx.project.settings.fabricMode !== 'evpn') return
  const vlans = vlansOnSwitch(ctx)
  if (vlans.length === 0) return
  const loopback = ctx.ipPlan.loopbacks[ctx.self.id]
  const vrfList = vrfsOnSwitch(ctx)

  out.block('interface vxlan 1', (b) => {
    b.line('no shutdown')
    if (loopback) b.line(`source-ip ${loopback}`)
    for (const vlan of vlans) {
      const vni = ctx.ipPlan.l2Vnis[vlan.id]
      if (vni === undefined) continue
      b.block(`vni ${vni}`, (vb) => {
        vb.line(`vlan ${vlan.vlanId}`)
      })
    }
    for (const vrf of vrfList) {
      const l3vni = ctx.ipPlan.l3Vnis[vrf.id]
      if (l3vni === undefined) continue
      b.block(`vrf ${vrf.name}`, (vb) => {
        vb.line(`vni ${l3vni}`)
      })
    }
  })
  out.blank()
}
