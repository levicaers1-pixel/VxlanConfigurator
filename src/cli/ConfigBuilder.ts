/**
 * Indentation-aware line accumulator for AOS-CX config output. AOS-CX config
 * blocks are indent-significant with no `!`/`end` delimiters, so callers
 * describe structure with `block()` and the builder handles indent push/pop.
 */
export class ConfigBuilder {
  private lines: string[] = []
  private depth = 0

  line(text = ''): this {
    this.lines.push(text === '' ? '' : '    '.repeat(this.depth) + text)
    return this
  }

  blank(): this {
    this.lines.push('')
    return this
  }

  comment(text: string): this {
    return this.line(`! ${text}`)
  }

  /** Emits `header`, then runs `fn` with indentation increased by one level. */
  block(header: string, fn: (b: ConfigBuilder) => void): this {
    this.line(header)
    this.depth += 1
    fn(this)
    this.depth -= 1
    return this
  }

  toString(): string {
    // collapse 3+ consecutive blank lines and trim trailing blank lines
    return this.lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\n+$/g, '\n')
  }
}
