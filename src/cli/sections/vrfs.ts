import type { SectionBuilder } from '../context'
import { vrfsOnSwitch } from '../context'

export const vrfs: SectionBuilder = (ctx, out) => {
  if (ctx.self.role === 'spine') return
  const list = vrfsOnSwitch(ctx)
  for (const vrf of list) {
    out.line(`vrf ${vrf.name}`)
  }
  if (list.length > 0) out.blank()
}
