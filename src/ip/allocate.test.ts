import { describe, expect, it } from 'vitest'
import type { Link, Project, SwitchInstance, VlanMapping } from '../domain/types'
import { computeIpPlan } from './allocate'

function baseSettings(overrides: Partial<Project['settings']> = {}): Project['settings'] {
  return {
    fabricMode: 'evpn',
    underlayProtocol: 'ebgp',
    asnScheme: 'per-device-unique',
    baseAsn: 65000,
    pools: {
      underlayP2P: { supernet: '10.0.0.0/24' },
      loopback: { supernet: '10.255.0.0/24' },
      vsxKeepalive: { supernet: '10.255.255.0/24' },
      mgmt: { supernet: '192.168.1.0/24' },
      tenantSubnets: { supernet: '10.10.0.0/16' },
    },
    tenantSubnetPrefixLen: 24,
    vniAllocation: {
      l2VniStrategy: 'vlan-plus-offset',
      l2VniOffset: 10000,
      l3VniPoolStart: 100000,
    },
    jumboMtu: true,
    ...overrides,
  }
}

function sw(id: string, role: SwitchInstance['role'], sequence: number, vsxGroupId?: string): SwitchInstance {
  return {
    id,
    catalogId: 'aruba-8325-32c',
    name: id,
    role,
    sequence,
    vsxGroupId,
    position: { x: 0, y: 0 },
  }
}

function link(id: string, aId: string, bId: string, kind: Link['kind'] = 'underlay-p2p'): Link {
  return {
    id,
    a: { switchInstanceId: aId, portName: '1/1/1' },
    b: { switchInstanceId: bId, portName: '1/1/1' },
    kind,
  }
}

function baseProject(overrides: Partial<Project> = {}): Project {
  return {
    formatVersion: 1,
    projectName: 'test',
    createdAt: '',
    updatedAt: '',
    settings: baseSettings(),
    switches: [],
    links: [],
    vlans: [],
    vrfs: [],
    ...overrides,
  }
}

describe('computeIpPlan — basic spine-leaf mesh', () => {
  it('allocates loopbacks and underlay /31s deterministically', () => {
    const spine1 = sw('spine1', 'spine', 1)
    const spine2 = sw('spine2', 'spine', 2)
    const leaf1 = sw('leaf1', 'leaf', 1)
    const leaf2 = sw('leaf2', 'leaf', 2)
    const links = [
      link('l1', 'spine1', 'leaf1'),
      link('l2', 'spine1', 'leaf2'),
      link('l3', 'spine2', 'leaf1'),
      link('l4', 'spine2', 'leaf2'),
    ]
    const project = baseProject({ switches: [spine1, spine2, leaf1, leaf2], links })
    const result = computeIpPlan(project)

    expect(result.errors).toHaveLength(0)
    expect(result.loopbacks.spine1).toBe('10.255.0.0')
    expect(result.loopbacks.spine2).toBe('10.255.0.1')
    expect(result.loopbacks.leaf1).toBe('10.255.0.2')
    expect(result.loopbacks.leaf2).toBe('10.255.0.3')

    // Underlay links carved in sorted order: spine1-leaf1, spine1-leaf2, spine2-leaf1, spine2-leaf2
    expect(result.underlayLinkIps.l1).toEqual({ aIp: '10.0.0.0', bIp: '10.0.0.1', prefixLen: 31 })
    expect(result.underlayLinkIps.l2).toEqual({ aIp: '10.0.0.2', bIp: '10.0.0.3', prefixLen: 31 })
    // l3 = spine2 <-> leaf1: spine2 is earlier in global topology order (spines before leaves), so it gets the first address.
    expect(result.underlayLinkIps.l3).toEqual({ aIp: '10.0.0.4', bIp: '10.0.0.5', prefixLen: 31 })
    expect(result.underlayLinkIps.l4).toEqual({ aIp: '10.0.0.6', bIp: '10.0.0.7', prefixLen: 31 })
  })

  it('is stable across edits: adding a new leaf does not renumber existing leaves', () => {
    const spine1 = sw('spine1', 'spine', 1)
    const leaf1 = sw('leaf1', 'leaf', 1)
    const leaf2 = sw('leaf2', 'leaf', 2)
    const before = computeIpPlan(
      baseProject({
        switches: [spine1, leaf1, leaf2],
        links: [link('l1', 'spine1', 'leaf1'), link('l2', 'spine1', 'leaf2')],
      }),
    )

    const leaf3 = sw('leaf3', 'leaf', 3)
    const after = computeIpPlan(
      baseProject({
        switches: [spine1, leaf1, leaf2, leaf3],
        links: [link('l1', 'spine1', 'leaf1'), link('l2', 'spine1', 'leaf2'), link('l3', 'spine1', 'leaf3')],
      }),
    )

    expect(after.loopbacks.leaf1).toBe(before.loopbacks.leaf1)
    expect(after.loopbacks.leaf2).toBe(before.loopbacks.leaf2)
    expect(after.underlayLinkIps.l1).toEqual(before.underlayLinkIps.l1)
    expect(after.underlayLinkIps.l2).toEqual(before.underlayLinkIps.l2)
  })
})

describe('computeIpPlan — VSX keepalive', () => {
  it('assigns one /31 per VSX group, ordered by lowest member sequence', () => {
    const leaf1 = sw('leaf1', 'leaf', 1, 'vsxA')
    const leaf2 = sw('leaf2', 'leaf', 2, 'vsxA')
    const leaf3 = sw('leaf3', 'leaf', 3, 'vsxB')
    const leaf4 = sw('leaf4', 'leaf', 4, 'vsxB')
    const project = baseProject({ switches: [leaf1, leaf2, leaf3, leaf4] })
    const result = computeIpPlan(project)

    expect(result.vsxKeepalives.vsxA).toEqual({
      primaryIp: '10.255.255.0',
      secondaryIp: '10.255.255.1',
      primarySwitchId: 'leaf1',
      secondarySwitchId: 'leaf2',
    })
    expect(result.vsxKeepalives.vsxB).toEqual({
      primaryIp: '10.255.255.2',
      secondaryIp: '10.255.255.3',
      primarySwitchId: 'leaf3',
      secondarySwitchId: 'leaf4',
    })
  })

  it('warns when a VSX group does not have exactly 2 members', () => {
    const leaf1 = sw('leaf1', 'leaf', 1, 'vsxA')
    const project = baseProject({ switches: [leaf1] })
    const result = computeIpPlan(project)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ severity: 'warning', scope: 'vsx', refId: 'vsxA' }),
    )
  })
})

describe('computeIpPlan — overrides', () => {
  it('honors loopbackOverride and link ipOverride instead of carving from the pool', () => {
    const spine1 = { ...sw('spine1', 'spine', 1), loopbackOverride: '9.9.9.9' }
    const leaf1 = sw('leaf1', 'leaf', 1)
    const l = link('l1', 'spine1', 'leaf1')
    l.ipOverride = { aIp: '172.16.0.0', bIp: '172.16.0.1', prefixLen: 31 }
    const project = baseProject({ switches: [spine1, leaf1], links: [l] })
    const result = computeIpPlan(project)

    expect(result.loopbacks.spine1).toBe('9.9.9.9')
    expect(result.underlayLinkIps.l1).toEqual({ aIp: '172.16.0.0', bIp: '172.16.0.1', prefixLen: 31 })
  })
})

describe('computeIpPlan — pool exhaustion', () => {
  it('reports non-fatal errors and still allocates everything it can', () => {
    const switches: SwitchInstance[] = [sw('spine1', 'spine', 1), sw('leaf1', 'leaf', 1), sw('leaf2', 'leaf', 2)]
    const project = baseProject({
      switches,
      settings: baseSettings({ pools: { ...baseSettings().pools, loopback: { supernet: '10.255.0.0/31' } } }),
    })
    const result = computeIpPlan(project)

    // Pool has only 2 addresses for 3 switches — spine1 and leaf1 (sorted first) get one each, leaf2 gets an error.
    expect(result.loopbacks.spine1).toBe('10.255.0.0')
    expect(result.loopbacks.leaf1).toBe('10.255.0.1')
    expect(result.loopbacks.leaf2).toBeUndefined()
    expect(result.errors).toContainEqual(
      expect.objectContaining({ severity: 'error', scope: 'loopback', refId: 'leaf2' }),
    )
  })
})

describe('computeIpPlan — management IPs', () => {
  it('auto-allocates mgmt IPs for every switch, skipping the network and gateway addresses', () => {
    const spine1 = sw('spine1', 'spine', 1)
    const leaf1 = sw('leaf1', 'leaf', 1)
    const project = baseProject({ switches: [spine1, leaf1] })
    const result = computeIpPlan(project)

    expect(result.mgmtGateway).toBe('192.168.1.1')
    expect(result.mgmtIps.spine1).toBe('192.168.1.2/24')
    expect(result.mgmtIps.leaf1).toBe('192.168.1.3/24')
  })

  it('honors a managementIp override verbatim instead of carving from the pool', () => {
    const spine1 = { ...sw('spine1', 'spine', 1), managementIp: '10.99.0.5/24' }
    const project = baseProject({ switches: [spine1] })
    const result = computeIpPlan(project)
    expect(result.mgmtIps.spine1).toBe('10.99.0.5/24')
  })

  it('allocates mgmt IPs for access-role switches too', () => {
    const access1 = sw('access1', 'access', 1)
    const project = baseProject({ switches: [access1] })
    const result = computeIpPlan(project)
    expect(result.mgmtIps.access1).toBe('192.168.1.2/24')
  })
})

describe('computeIpPlan — access role exclusion', () => {
  it('does not allocate a loopback or ASN for access-role switches', () => {
    const spine1 = sw('spine1', 'spine', 1)
    const access1 = sw('access1', 'access', 1)
    const project = baseProject({ switches: [spine1, access1] })
    const result = computeIpPlan(project)

    expect(result.loopbacks.access1).toBeUndefined()
    expect(result.asns.access1).toBeUndefined()
    expect(result.loopbacks.spine1).toBe('10.255.0.0')
    expect(result.asns.spine1).toBe(65001)
  })
})

describe('computeIpPlan — VNIs and tenant subnets', () => {
  it('derives L2VNI from vlan+offset and L3VNI from sorted VRF index', () => {
    const vlans: VlanMapping[] = [
      { id: 'v10', vlanId: 10, name: 'WEB', vrfId: 'vrfA' },
      { id: 'v20', vlanId: 20, name: 'DB', vrfId: 'vrfA' },
    ]
    const project = baseProject({
      vlans,
      vrfs: [{ id: 'vrfA', name: 'CUSTOMER-A' }],
    })
    const result = computeIpPlan(project)

    expect(result.l2Vnis.v10).toBe(10010)
    expect(result.l2Vnis.v20).toBe(10020)
    expect(result.l3Vnis.vrfA).toBe(100000)
    expect(result.tenantSubnets.v10).toBe('10.10.0.0/24')
    expect(result.tenantSubnets.v20).toBe('10.10.1.0/24')
  })
})
