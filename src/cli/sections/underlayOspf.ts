import type { SectionBuilder } from '../context'

export const underlayOspf: SectionBuilder = (ctx, out) => {
  if (ctx.project.settings.underlayProtocol !== 'ospf') return
  const processId = ctx.project.settings.ospfProcessId ?? 1
  const loopback = ctx.ipPlan.loopbacks[ctx.self.id]

  out.block(`router ospf ${processId}`, (b) => {
    if (loopback) b.line(`router-id ${loopback}`)
    b.comment('Interfaces are enabled for this process via per-interface "ip ospf" commands (see interface config below).')
  })
  out.blank()
}
