import type { SectionBuilder } from '../context'

export const hostname: SectionBuilder = (ctx, out) => {
  out.line(`hostname ${ctx.self.name}`)
  out.blank()
}
