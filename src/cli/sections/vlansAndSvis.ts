import type { SectionBuilder } from '../context'
import { vlansOnSwitch } from '../context'
import { intToIp, parseCidr } from '../../ip/cidr'
import { deterministicMac } from '../macGen'

export const vlansAndSvis: SectionBuilder = (ctx, out) => {
  if (ctx.self.role === 'spine') return
  const vlans = vlansOnSwitch(ctx)

  for (const vlan of vlans) {
    out.block(`vlan ${vlan.vlanId}`, (b) => {
      b.line(`name ${vlan.name}`)
    })
    out.blank()
  }

  for (const vlan of vlans) {
    if (!vlan.vrfId) continue
    const vrf = ctx.project.vrfs.find((v) => v.id === vlan.vrfId)
    if (!vrf) continue
    const subnetCidr = ctx.ipPlan.tenantSubnets[vlan.id]
    if (!subnetCidr) {
      out.comment(`ERROR: no subnet allocated for VLAN ${vlan.vlanId} — enlarge the tenant subnet pool in Settings`)
      out.blank()
      continue
    }
    const { network, prefixLen } = parseCidr(subnetCidr)
    const gatewayIp = intToIp((network + 1) >>> 0)

    let realIp = gatewayIp
    let isVsx = false
    if (ctx.self.vsxGroupId) {
      const kv = ctx.ipPlan.vsxKeepalives[ctx.self.vsxGroupId]
      if (kv) {
        isVsx = true
        const offset = kv.primarySwitchId === ctx.self.id ? 2 : 3
        realIp = intToIp((network + offset) >>> 0)
      }
    }
    const gwMac = vlan.activeGatewayMacOverride ?? deterministicMac('01', vlan.id)

    // interface vlan <ID> — note the space; AOS-CX rejects "vlan10" run together.
    out.block(`interface vlan ${vlan.vlanId}`, (b) => {
      if (isVsx) b.line('vsx-sync active-gateways')
      if (ctx.project.settings.jumboMtu) b.line('ip mtu 9198')
      b.line(`vrf attach ${vrf.name}`)
      b.line(`ip address ${realIp}/${prefixLen}`)
      // Real syntax is a single combined command, not two separate "active-gateway" lines.
      if (isVsx) b.line(`active-gateway ip ${gatewayIp} mac ${gwMac}`)
    })
    out.blank()
  }
}
