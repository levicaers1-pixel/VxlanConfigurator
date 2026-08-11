import { describe, expect, it } from 'vitest'
import {
  defaultCatalogIdForRole,
  deriveDeviceName,
  deriveModelName,
  matchShapeToCatalog,
  synthesizeCatalogEntry,
} from './matchCatalog'

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

  it('falls back to access (the safe default) when nothing matches and no role keyword is present', () => {
    // 'standalone' gets the full EVPN/VXLAN fabric recipe in CLI generation — defaulting
    // an unidentified device there would fabricate meaningless config. 'access' only
    // generates hostname/mgmt/trunk config, which is safe for hardware we know nothing about.
    const result = matchShapeToCatalog('Unlabeled Box')
    expect(result.entry).toBeUndefined()
    expect(result.role).toBe('access')
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

describe('deriveModelName', () => {
  it('strips the bracketed SKU suffix and a trailing instance number', () => {
    expect(deriveModelName('HPE ANW 2930M 48G PoE+ 1-slot Switch #5 [JL322A]')).toBe(
      'HPE ANW 2930M 48G PoE+ 1-slot Switch',
    )
  })

  it('leaves a plain label unchanged', () => {
    expect(deriveModelName('Core switch')).toBe('Core switch')
  })
})

describe('synthesizeCatalogEntry', () => {
  it('builds a custom, clearly-flagged catalog entry from a label and SKU', () => {
    const entry = synthesizeCatalogEntry('HPE ANW 2930M 48G PoE+ 1-slot Switch #5 [JL322A]', 'JL322A', 'access')
    expect(entry.custom).toBe(true)
    expect(entry.vendor).toBe('Custom')
    expect(entry.supportsVsx).toBe(false)
    expect(entry.supportsEvpn).toBe(false)
    expect(entry.suitableRoles).toEqual(['access'])
    expect(entry.model).toContain('2930M')
    expect(entry.portGroups[0].count).toBe(48)
  })

  it('produces the same id for the same SKU so instances of one real model share one catalog entry', () => {
    const a = synthesizeCatalogEntry('HPE ANW 2930M 48G PoE+ 1-slot Switch #5 [JL322A]', 'JL322A', 'access')
    const b = synthesizeCatalogEntry('HPE ANW 2930M 48G PoE+ 1-slot Switch #7 [JL322A]', 'JL322A', 'access')
    expect(a.id).toBe(b.id)
  })

  it('produces different ids for different SKUs', () => {
    const a = synthesizeCatalogEntry('Switch A [JL322A]', 'JL322A', 'access')
    const b = synthesizeCatalogEntry('Switch B [JL679A]', 'JL679A', 'access')
    expect(a.id).not.toBe(b.id)
  })

  it('falls back to a generic port count when nothing in the label hints at one', () => {
    const entry = synthesizeCatalogEntry('Some Mystery Switch', undefined, 'standalone')
    expect(entry.portGroups[0].count).toBe(24)
  })
})
