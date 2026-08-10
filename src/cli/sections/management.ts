import type { SectionBuilder } from '../context'

export const management: SectionBuilder = (ctx, out) => {
  const ip = ctx.ipPlan.mgmtIps[ctx.self.id]
  if (!ip) return
  const gateway = ctx.self.managementGateway ?? ctx.ipPlan.mgmtGateway
  out.block('interface mgmt', (b) => {
    b.line('no shutdown')
    b.line(`ip static ${ip}`)
    if (gateway) b.line(`default-gateway ${gateway}`)
  })
  out.blank()
}
