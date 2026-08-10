import type { SectionBuilder } from '../context'
import { ownAndPeerIp, ownPort, peerSwitch } from '../context'

export const interfacesPhysical: SectionBuilder = (ctx, out) => {
  const loopback = ctx.ipPlan.loopbacks[ctx.self.id]
  if (loopback) {
    out.block('interface loopback 0', (b) => {
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
}
