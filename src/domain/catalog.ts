import type { SwitchCatalogEntry } from './types'

/**
 * Hardcoded Aruba CX data-center switch catalog. Port counts/speeds are
 * representative of commonly deployed SKUs per series, not an exhaustive
 * list of every part number. VSX/EVPN support reflects current AOS-CX
 * capability per series — verify against the target firmware release.
 */
export const SWITCH_CATALOG: SwitchCatalogEntry[] = [
  {
    id: 'aruba-8320-48y6c',
    vendor: 'Aruba',
    series: 'CX 8320',
    model: '8320-48Y6C',
    suitableRoles: ['leaf', 'border'],
    portGroups: [
      { count: 48, speedGbps: 25, namePrefix: '1/1/', startIndex: 1 },
      { count: 6, speedGbps: 100, namePrefix: '1/1/', startIndex: 49 },
    ],
    supportsVsx: true,
    supportsEvpn: true,
    maxVlans: 4094,
    notes: '48x 1/10/25G SFP28 downlinks + 6x 40/100G QSFP28 uplinks. Common ToR leaf.',
  },
  {
    id: 'aruba-8325-32c',
    vendor: 'Aruba',
    series: 'CX 8325',
    model: '8325-32C',
    suitableRoles: ['spine', 'leaf'],
    portGroups: [{ count: 32, speedGbps: 100, namePrefix: '1/1/', startIndex: 1 }],
    supportsVsx: true,
    supportsEvpn: true,
    maxVlans: 4094,
    notes: '32x 40/100G QSFP28, high port-density — typical EVPN fabric spine.',
  },
  {
    id: 'aruba-8325-48y8c',
    vendor: 'Aruba',
    series: 'CX 8325',
    model: '8325-48Y8C',
    suitableRoles: ['leaf', 'spine'],
    portGroups: [
      { count: 48, speedGbps: 25, namePrefix: '1/1/', startIndex: 1 },
      { count: 8, speedGbps: 100, namePrefix: '1/1/', startIndex: 49 },
    ],
    supportsVsx: true,
    supportsEvpn: true,
    maxVlans: 4094,
    notes: '48x 1/10/25G SFP28 + 8x 40/100G QSFP28. Common VSX-paired leaf.',
  },
  {
    id: 'aruba-8360-24xf4c',
    vendor: 'Aruba',
    series: 'CX 8360',
    model: '8360-24XF4C',
    suitableRoles: ['leaf'],
    portGroups: [
      { count: 24, speedGbps: 25, namePrefix: '1/1/', startIndex: 1 },
      { count: 4, speedGbps: 100, namePrefix: '1/1/', startIndex: 25 },
    ],
    supportsVsx: true,
    supportsEvpn: true,
    maxVlans: 4094,
    notes: 'Fanless 24x 10/25G SFP28 + 4x 40/100G QSFP28. Smaller-footprint leaf.',
  },
  {
    id: 'aruba-8400-core',
    vendor: 'Aruba',
    series: 'CX 8400',
    model: '8400 (2x 24p 40/100G modules)',
    suitableRoles: ['spine', 'border'],
    portGroups: [{ count: 48, speedGbps: 100, namePrefix: '1/1/', startIndex: 1 }],
    supportsVsx: true,
    supportsEvpn: true,
    maxVlans: 4094,
    notes: 'Modular DC core chassis; port count shown assumes two 24-port 40/100G line cards. Actual slot/module config varies per deployment.',
  },
  {
    id: 'aruba-9300-32d',
    vendor: 'Aruba',
    series: 'CX 9300',
    model: '9300-32D',
    suitableRoles: ['spine'],
    portGroups: [{ count: 32, speedGbps: 400, namePrefix: '1/1/', startIndex: 1 }],
    supportsVsx: true,
    supportsEvpn: true,
    maxVlans: 4094,
    notes: '32x 400G QSFP-DD, highest density spine option for large EVPN fabrics.',
  },
  {
    id: 'aruba-9300-48y4c',
    vendor: 'Aruba',
    series: 'CX 9300',
    model: '9300-48Y4C',
    suitableRoles: ['leaf', 'spine'],
    portGroups: [
      { count: 48, speedGbps: 25, namePrefix: '1/1/', startIndex: 1 },
      { count: 4, speedGbps: 100, namePrefix: '1/1/', startIndex: 49 },
    ],
    supportsVsx: true,
    supportsEvpn: true,
    maxVlans: 4094,
    notes: '48x 1/10/25G SFP56 + 4x 100G QSFP28 uplinks. Latest-generation leaf.',
  },
]

export function getCatalogEntry(id: string): SwitchCatalogEntry | undefined {
  return SWITCH_CATALOG.find((c) => c.id === id)
}
