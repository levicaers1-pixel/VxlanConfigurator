import type { SectionBuilder } from '../context'
import { ownAndPeerIp, ownPort, peerSwitch } from '../context'

/** AOS-CX loopback interface IDs range 1-256 (0 is not valid). */
export const LOOPBACK_ID = 1

export const interfacesPhysical: SectionBuilder = (ctx, out) => {
  const loopback = ctx.ipPlan.loopbacks[ctx.self.id]
  if (loopback) {
    out.block(`interface loopback ${LOOPBACK_ID}`, (b) => {
      b.line(`ip address ${loopback}/32`)
      if (ctx.project.settings.fabricMode === 'evpn' && ctx.project.settings.underlayProtocol === 'ospf') {
        b.line(`ip ospf ${ctx.project.settings.ospfProcessId ?? 1} area ${ctx.project.settings.ospfArea ?? '0.0.0.0'}`)
      }
    })
    out.blank()
  }

  const underlayLinks = ctx.peerLinks.filter((l) => l.kind === 'underlay-p2p')
  for (const link of underlayLinks) {
    const port = ownPort(ctx, link)
    const peer = peerSwitch(ctx, link)
    const ip = ownAndPeerIp(ctx, link)
    out.block(`interface ${port}`, (b) => {
      b.line('no shutdown')
      b.line(`description underlay-to-${peer?.name ?? 'unknown'}`)
      b.line('no routing')
      if (ip) b.line(`ip address ${ip.ownIp}/${ip.prefixLen}`)
      if (ctx.project.settings.jumboMtu) b.line('mtu 9198')
      if (ctx.project.settings.fabricMode === 'evpn' && ctx.project.settings.underlayProtocol === 'ospf') {
        b.line(`ip ospf ${ctx.project.settings.ospfProcessId ?? 1} area ${ctx.project.settings.ospfArea ?? '0.0.0.0'}`)
      }
    })
    out.blank()
  }

  // Dedicated VSX keepalive link — gives the `keepalive peer/source` IPs in
  // vsx.ts an actual routed interface to live on, instead of referencing
  // addresses that were never assigned to any port.
  const keepaliveLinks = ctx.peerLinks.filter((l) => l.kind === 'vsx-keepalive')
  if (keepaliveLinks.length > 0 && ctx.self.vsxGroupId) {
    const kv = ctx.ipPlan.vsxKeepalives[ctx.self.vsxGroupId]
    if (kv) {
      const ownIp = kv.primarySwitchId === ctx.self.id ? kv.primaryIp : kv.secondaryIp
      for (const link of keepaliveLinks) {
        const port = ownPort(ctx, link)
        const peer = peerSwitch(ctx, link)
        out.block(`interface ${port}`, (b) => {
          b.line('no shutdown')
          b.line(`description vsx-keepalive-to-${peer?.name ?? 'unknown'}`)
          b.line('no routing')
          b.line(`ip address ${ownIp}/31`)
        })
        out.blank()
      }
    }
  }
}
