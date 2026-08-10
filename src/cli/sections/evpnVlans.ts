import type { SectionBuilder } from '../context'
import { vlansOnSwitch } from '../context'

/**
 * Per-VLAN EVPN route identity, per Aruba AOS-CX docs (Chp_EVPN/EVPN_cmds,
 * 8320/8325 CLI Bank): a top-level `evpn` context, then `vlan <id>` per
 * L2VNI, with `rd`/`route-target` nested inside — NOT under `router bgp`.
 * "rd auto" is Aruba's documented recommendation (derives VTEP_IP:VLAN_ID).
 */
export const evpnVlans: SectionBuilder = (ctx, out) => {
  if (ctx.project.settings.fabricMode !== 'evpn') return
  if (ctx.self.role === 'spine') return
  const vlans = vlansOnSwitch(ctx)
  if (vlans.length === 0) return

  out.block('evpn', (b) => {
    for (const vlan of vlans) {
      b.block(`vlan ${vlan.vlanId}`, (vb) => {
        vb.line('rd auto')
        vb.line('route-target both auto')
      })
    }
  })
  out.blank()
}
