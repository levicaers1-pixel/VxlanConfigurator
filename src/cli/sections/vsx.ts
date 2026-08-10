import type { SectionBuilder } from '../context'
import { ownPort } from '../context'
import { deterministicMac } from '../macGen'

const VSX_ISL_LAG_ID = 256

export const vsx: SectionBuilder = (ctx, out) => {
  if (!ctx.self.vsxGroupId || !ctx.vsxPeer) return
  const kv = ctx.ipPlan.vsxKeepalives[ctx.self.vsxGroupId]
  if (!kv) {
    out.comment(`ERROR: no VSX keepalive IP allocated for group ${ctx.self.vsxGroupId} — enlarge the VSX keepalive pool in Settings`)
    out.blank()
    return
  }
  const isPrimary = kv.primarySwitchId === ctx.self.id
  const ownIp = isPrimary ? kv.primaryIp : kv.secondaryIp
  const peerIp = isPrimary ? kv.secondaryIp : kv.primaryIp
  const systemMac = deterministicMac('00', ctx.self.vsxGroupId)

  out.block('vsx', (b) => {
    b.line(`system-mac ${systemMac}`)
    b.line(`inter-switch-link lag ${VSX_ISL_LAG_ID}`)
    b.line(`role ${isPrimary ? 'primary' : 'secondary'}`)
    b.comment('keepalive peering shown over a directly-addressed link; use a dedicated OOB/keepalive VRF per site standards')
    b.line(`keepalive peer ${peerIp} source ${ownIp}`)
    b.line('linkup-delay-timer 600')
    b.line('vsx-sync vsx-global')
  })
  out.blank()

  const islLinks = ctx.peerLinks.filter((l) => l.kind === 'vsx-isl')
  out.block(`interface lag ${VSX_ISL_LAG_ID}`, (b) => {
    b.line('no shutdown')
    b.line('description VSX-ISL')
    b.line('no routing')
    b.line('vlan trunk native 1')
    b.line('vlan trunk allowed all')
  })
  out.blank()

  for (const link of islLinks) {
    const port = ownPort(ctx, link)
    out.block(`interface ${port}`, (b) => {
      b.line('no shutdown')
      b.line(`lag ${VSX_ISL_LAG_ID}`)
    })
    out.blank()
  }

  if (islLinks.length === 0) {
    out.comment('No links marked as vsx-isl for this pair — set link kind to "vsx-isl" in the Inspector for the ISL trunk ports')
    out.blank()
  }
}
