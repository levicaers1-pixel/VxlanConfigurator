import type { SectionBuilder } from '../context'
import { ownPort, peerSwitch } from '../context'

/**
 * Access switches sit outside the VXLAN fabric — every link gets a plain
 * 802.1Q trunk toward the leaf/aggregation layer, no IP addressing or
 * routing regardless of the link's `kind` (access switches don't
 * participate in underlay/overlay allocation at all).
 */
export const accessPorts: SectionBuilder = (ctx, out) => {
  if (ctx.peerLinks.length === 0) return
  for (const link of ctx.peerLinks) {
    const port = ownPort(ctx, link)
    const peer = peerSwitch(ctx, link)
    out.block(`interface ${port}`, (b) => {
      b.line('no shutdown')
      b.line(`description uplink-to-${peer?.name ?? 'unknown'}`)
      b.line('no routing')
      b.line('vlan trunk native 1')
      b.line('vlan trunk allowed all')
    })
    out.blank()
  }
}
