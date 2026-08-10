import type { SectionBuilder } from '../context'
import { vlansOnSwitch, vlansPresentOn } from '../context'

/**
 * Static VXLAN overlay: no EVPN control plane. Each L2VNI gets an explicit
 * remote-VTEP flood list, derived structurally from the topology — every
 * other switch (excluding this switch's own VSX peer, which shares a VTEP
 * via the ISL, not a remote tunnel) that also carries the VLAN.
 */
export const overlayStaticVxlan: SectionBuilder = (ctx, out) => {
  if (ctx.project.settings.fabricMode !== 'static-vxlan') return
  if (ctx.self.role === 'spine') return
  const ownLoopback = ctx.ipPlan.loopbacks[ctx.self.id]
  if (!ownLoopback) return

  const selfVlans = vlansOnSwitch(ctx)
  if (selfVlans.length === 0) return

  out.block('interface vxlan 1', (b) => {
    b.line('no shutdown')
    b.line(`source ip ${ownLoopback}`)
    b.comment('Static mode: no BGP EVPN — remote VTEP peers below are derived from topology, not learned dynamically.')

    for (const vlan of selfVlans) {
      const vni = ctx.ipPlan.l2Vnis[vlan.id]
      if (vni === undefined) continue

      const remoteSwitches = ctx.project.switches.filter((other) => {
        if (other.id === ctx.self.id) return false
        if (other.role === 'spine') return false
        if (ctx.self.vsxGroupId && other.vsxGroupId === ctx.self.vsxGroupId) return false
        return vlansPresentOn(ctx.project.vlans, other.id).some((v) => v.id === vlan.id)
      })

      b.block(`vni ${vni}`, (vb) => {
        vb.line(`vlan ${vlan.vlanId}`)
        const seen = new Set<string>()
        for (const remote of remoteSwitches) {
          const remoteLoopback = ctx.ipPlan.loopbacks[remote.id]
          if (!remoteLoopback || seen.has(remoteLoopback)) continue
          seen.add(remoteLoopback)
          vb.line(`vtep-peer ${remoteLoopback}`)
        }
        if (seen.size === 0) {
          vb.comment('No remote VTEP peers found for this VLAN — single-site/no-flood-list topology, or VLAN not present elsewhere.')
        }
      })
    }
  })
  out.blank()
}
