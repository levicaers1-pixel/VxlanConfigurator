import type { SectionBuilder } from '../context'

export const management: SectionBuilder = (ctx, out) => {
  if (!ctx.self.managementIp) return
  out.block('interface mgmt', (b) => {
    b.line('no shutdown')
    b.line(`ip static ${ctx.self.managementIp}`)
    if (ctx.self.managementGateway) b.line(`default-gateway ${ctx.self.managementGateway}`)
  })
  out.blank()
}
