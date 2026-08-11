import { describe, expect, it } from 'vitest'
import {
  defaultCatalogIdForRole,
  deriveDeviceName,
  deriveModelName,
  looksLikeNetworkSwitch,
  matchShapeToCatalog,
  synthesizeCatalogEntry,
} from './matchCatalog'

describe('matchShapeToCatalog', () => {
  it('matches a full model string embedded in a multi-line label, high confidence', () => {
    const result = matchShapeToCatalog('Spine1\n8325-32C', 'evpn')
    expect(result.entry?.id).toBe('aruba-8325-32c')
    expect(result.role).toBe('spine')
    expect(result.confidence).toBe('high')
  })

  it('matches regardless of spacing/dash differences via normalization', () => {
    const result = matchShapeToCatalog('leaf-a 8325 48Y8C uplink', 'evpn')
    expect(result.entry?.id).toBe('aruba-8325-48y8c')
  })

  it('does not falsely match a shorter model string against a longer variant label', () => {
    // "8325-32C" alone must not match the breakout variant's longer model string.
    const result = matchShapeToCatalog('Spine2 8325-32C', 'evpn')
    expect(result.entry?.id).toBe('aruba-8325-32c')
  })

  it('infers role from keywords even without a catalog match', () => {
    const result = matchShapeToCatalog('Border switch TBD', 'evpn')
    expect(result.entry).toBeUndefined()
    expect(result.role).toBe('border')
    expect(result.confidence).toBe('low')
  })

  it('in EVPN mode, falls back to access (the safe default) when nothing matches and no role keyword is present', () => {
    // Any non-'access' role gets the full BGP EVPN fabric recipe in CLI generation —
    // defaulting an unidentified device there would fabricate meaningless BGP/route-target
    // config. 'access' only generates hostname/mgmt/trunk config, safe for unknown hardware.
    const result = matchShapeToCatalog('Unlabeled Box', 'evpn')
    expect(result.entry).toBeUndefined()
    expect(result.role).toBe('access')
    expect(result.confidence).toBe('low')
  })

  it('in static-vxlan mode, falls back to standalone (not access) so the switch still gets VNI/overlay config', () => {
    // Every non-'access' role gets the identical staticVxlan recipe, whose overlay is
    // structurally derived from the topology (not fabricated) — defaulting to 'access'
    // here would silently strip a real imported switch's VXLAN config entirely.
    const result = matchShapeToCatalog('Unlabeled Box', 'static-vxlan')
    expect(result.entry).toBeUndefined()
    expect(result.role).toBe('standalone')
    expect(result.confidence).toBe('low')
  })

  it('derives role from the matched entry when no explicit role keyword is present', () => {
    const result = matchShapeToCatalog('9300-32D', 'evpn')
    expect(result.entry?.id).toBe('aruba-9300-32d')
    expect(result.role).toBe('spine')
  })

  it('a confident catalog match uses the entry role regardless of fabric mode', () => {
    const result = matchShapeToCatalog('9300-32D', 'static-vxlan')
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
    const result = matchShapeToCatalog('Spine1\n8325-32C', 'evpn')
    expect(deriveDeviceName('Spine1\n8325-32C', result.entry)).toBe('Spine1')
  })

  it('returns undefined when every line is just the model string', () => {
    const result = matchShapeToCatalog('8325-32C', 'evpn')
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

describe('looksLikeNetworkSwitch', () => {
  it('defaults to included when the label says "switch"', () => {
    expect(looksLikeNetworkSwitch('HPE ANW 6200F 24G CL4 PoE 4SFP+ 370W Switch', 'JL725B')).toBe(true)
  })

  it('defaults to excluded for optics/DAC accessories even with a stencil SKU', () => {
    expect(looksLikeNetworkSwitch('DAC Plugin', 'J9283D')).toBe(false)
    expect(looksLikeNetworkSwitch('HPE ANW 10G SFP+ LC SR 400m OM4 MMF C-class XCVR', 'S2P30A')).toBe(false)
  })

  it('defaults to excluded for a software license icon', () => {
    expect(looksLikeNetworkSwitch('HPE ANW Central Cloud Licenses', 'R6U58AAE')).toBe(false)
  })

  it('defaults to excluded for a floor-plan room label with no stencil SKU', () => {
    expect(looksLikeNetworkSwitch('Punt 6 - Frozen Server room/Machine Kamer', undefined)).toBe(false)
  })

  it('defaults to included for a stencil instance with no keyword either way — more likely real equipment than not', () => {
    expect(looksLikeNetworkSwitch('Core-1', 'R9W92A')).toBe(true)
  })
})
