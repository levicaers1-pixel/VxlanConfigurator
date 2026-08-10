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
    if (loopback) b.line(`source ip ${loopback}`)
    for (const vlan of vlans) {
      const vni = ctx.ipPlan.l2Vnis[vlan.id]
      if (vni === undefined) continue
      b.block(`vni ${vni}`, (vb) => {
        vb.line(`vlan ${vlan.vlanId}`)
      })
    }
    // L3VNI: `vni <n>` is the outer context; `routing` enables symmetric IRB
    // on it, and `vrf <name>` (inner) assigns it to the tenant VRF. The vrf
    // and vni roles are NOT reversed — see Aruba's `vni`/`routing`/`vrf`
    // command docs (VXLAN_cmds chapter).
    for (const vrf of vrfList) {
      const l3vni = ctx.ipPlan.l3Vnis[vrf.id]
      if (l3vni === undefined) continue
      b.block(`vni ${l3vni}`, (vb) => {
        vb.line('routing')
        vb.line(`vrf ${vrf.name}`)
      })
    }
  })
  out.blank()
}
