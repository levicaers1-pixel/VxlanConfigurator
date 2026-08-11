import { describe, expect, it } from 'vitest'
import { defaultCatalogIdForRole, deriveDeviceName, matchShapeToCatalog } from './matchCatalog'

describe('matchShapeToCatalog', () => {
  it('matches a full model string embedded in a multi-line label, high confidence', () => {
    const result = matchShapeToCatalog('Spine1\n8325-32C')
    expect(result.entry?.id).toBe('aruba-8325-32c')
    expect(result.role).toBe('spine')
    expect(result.confidence).toBe('high')
  })

  it('matches regardless of spacing/dash differences via normalization', () => {
    const result = matchShapeToCatalog('leaf-a 8325 48Y8C uplink')
    expect(result.entry?.id).toBe('aruba-8325-48y8c')
  })

  it('does not falsely match a shorter model string against a longer variant label', () => {
    // "8325-32C" alone must not match the breakout variant's longer model string.
    const result = matchShapeToCatalog('Spine2 8325-32C')
    expect(result.entry?.id).toBe('aruba-8325-32c')
  })

  it('infers role from keywords even without a catalog match', () => {
    const result = matchShapeToCatalog('Border switch TBD')
    expect(result.entry).toBeUndefined()
    expect(result.role).toBe('border')
    expect(result.confidence).toBe('low')
  })

  it('falls back to standalone when nothing matches and no role keyword is present', () => {
    const result = matchShapeToCatalog('Unlabeled Box')
    expect(result.entry).toBeUndefined()
    expect(result.role).toBe('standalone')
    expect(result.confidence).toBe('low')
  })

  it('derives role from the matched entry when no explicit role keyword is present', () => {
    const result = matchShapeToCatalog('9300-32D')
    expect(result.entry?.id).toBe('aruba-9300-32d')
    expect(result.role).toBe('spine')
  })
})

describe('defaultCatalogIdForRole', () => {
  it('returns a catalog entry that supports the given role', () => {
    const id = defaultCatalogIdForRole('spine')
    expect(id).toBeDefined()
  })
})

describe('deriveDeviceName', () => {
  it('picks the label line that is not the matched model string', () => {
    const result = matchShapeToCatalog('Spine1\n8325-32C')
    expect(deriveDeviceName('Spine1\n8325-32C', result.entry)).toBe('Spine1')
  })

  it('returns undefined when every line is just the model string', () => {
    const result = matchShapeToCatalog('8325-32C')
    expect(deriveDeviceName('8325-32C', result.entry)).toBeUndefined()
  })
})
