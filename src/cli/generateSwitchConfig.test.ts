import { describe, expect, it } from 'vitest'
import type { Link, Project, SwitchInstance, TenantVrf, VlanMapping } from '../domain/types'
import { computeIpPlan } from '../ip/allocate'
import { generateSwitchConfig } from './generateSwitchConfig'

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
    vniAllocation: { l2VniStrategy: 'vlan-plus-offset', l2VniOffset: 10000, l3VniPoolStart: 100000 },
    jumboMtu: true,
    ...overrides,
  }
}

function sw(id: string, role: SwitchInstance['role'], sequence: number, catalogId: string, vsxGroupId?: string): SwitchInstance {
  return { id, catalogId, name: id.toUpperCase(), role, sequence, vsxGroupId, position: { x: 0, y: 0 } }
}

function link(id: string, aId: string, aPort: string, bId: string, bPort: string, kind: Link['kind']): Link {
  return { id, a: { switchInstanceId: aId, portName: aPort }, b: { switchInstanceId: bId, portName: bPort }, kind }
}

function buildFixture(settingsOverrides: Partial<Project['settings']> = {}) {
  const spine1 = sw('spine1', 'spine', 1, 'aruba-8325-32c')
  const spine2 = sw('spine2', 'spine', 2, 'aruba-8325-32c')
  const leaf1 = sw('leaf1', 'leaf', 1, 'aruba-8325-48y8c', 'vsxA')
  const leaf2 = sw('leaf2', 'leaf', 2, 'aruba-8325-48y8c', 'vsxA')

  const links: Link[] = [
    link('l1', 'spine1', '1/1/1', 'leaf1', '1/1/49', 'underlay-p2p'),
    link('l2', 'spine1', '1/1/2', 'leaf2', '1/1/49', 'underlay-p2p'),
    link('l3', 'spine2', '1/1/1', 'leaf1', '1/1/50', 'underlay-p2p'),
    link('l4', 'spine2', '1/1/2', 'leaf2', '1/1/50', 'underlay-p2p'),
    link('l5', 'leaf1', '1/1/51', 'leaf2', '1/1/51', 'vsx-isl'),
  ]

  const vrfs: TenantVrf[] = [{ id: 'vrfA', name: 'CUSTOMER-A' }]
  const vlans: VlanMapping[] = [
    { id: 'v10', vlanId: 10, name: 'WEB-TIER', vrfId: 'vrfA' },
    { id: 'v20', vlanId: 20, name: 'DB-TIER', vrfId: 'vrfA' },
  ]

  const project: Project = {
    formatVersion: 1,
    projectName: 'fixture',
    createdAt: '',
    updatedAt: '',
    settings: baseSettings(settingsOverrides),
    switches: [spine1, spine2, leaf1, leaf2],
    links,
    vlans,
    vrfs,
  }
  const ipPlan = computeIpPlan(project)
  return { project, ipPlan }
}

describe('generateSwitchConfig — EVPN, eBGP underlay', () => {
  const { project, ipPlan } = buildFixture()

  it('produces no allocation errors for the fixture topology', () => {
    expect(ipPlan.errors).toHaveLength(0)
  })

  it('generates a spine config (golden)', () => {
    expect(generateSwitchConfig('spine1', project, ipPlan)).toMatchSnapshot()
  })

  it('generates a VSX leaf config (golden)', () => {
    expect(generateSwitchConfig('leaf1', project, ipPlan)).toMatchSnapshot()
  })

  it('leaf config includes VSX, VLAN/VNI mapping, VRF, and EVPN address-family', () => {
    const config = generateSwitchConfig('leaf1', project, ipPlan)
    expect(config).toContain('vsx')
    expect(config).toContain('role primary')
    expect(config).toContain('vlan 10')
    expect(config).toContain('vn-vni 10010')
    expect(config).toContain('vrf CUSTOMER-A')
    expect(config).toContain('address-family l2vpn evpn')
    expect(config).toContain('interface vxlan 1')
  })

  it('spine config has no VLAN/VNI/VSX sections', () => {
    const config = generateSwitchConfig('spine1', project, ipPlan)
    expect(config).not.toContain('vn-vni')
    expect(config).not.toContain('vsx-sync')
    expect(config).not.toContain('interface vxlan')
  })
})

describe('generateSwitchConfig — EVPN, OSPF underlay', () => {
  const { project, ipPlan } = buildFixture({ underlayProtocol: 'ospf' })

  it('generates a spine config with OSPF + route-reflector EVPN peering (golden)', () => {
    expect(generateSwitchConfig('spine1', project, ipPlan)).toMatchSnapshot()
  })

  it('generates a leaf config with OSPF underlay + multihop EVPN peering (golden)', () => {
    expect(generateSwitchConfig('leaf1', project, ipPlan)).toMatchSnapshot()
  })

  it('leaf peers EVPN toward spine loopbacks with ebgp-multihop', () => {
    const config = generateSwitchConfig('leaf1', project, ipPlan)
    expect(config).toContain('ebgp-multihop 3')
    expect(config).toContain('router ospf 1')
  })

  it('spine acts as EVPN route-reflector toward leaves', () => {
    const config = generateSwitchConfig('spine1', project, ipPlan)
    expect(config).toContain('route-reflector-client')
  })
})

describe('generateSwitchConfig — static VXLAN (no EVPN)', () => {
  const { project, ipPlan } = buildFixture({ fabricMode: 'static-vxlan' })

  it('generates a VSX leaf config with static remote-VTEP flood lists (golden)', () => {
    expect(generateSwitchConfig('leaf1', project, ipPlan)).toMatchSnapshot()
  })

  it('generates a spine-role switch config too — static mode uses one recipe for every role', () => {
    expect(generateSwitchConfig('spine1', project, ipPlan)).toMatchSnapshot()
  })

  it('has no BGP EVPN address-family or route-distinguisher anywhere', () => {
    const leaf = generateSwitchConfig('leaf1', project, ipPlan)
    const spine = generateSwitchConfig('spine1', project, ipPlan)
    expect(leaf).not.toContain('l2vpn evpn')
    expect(leaf).not.toContain('route-distinguisher')
    expect(spine).not.toContain('l2vpn evpn')
  })

  it('spines carry no VLANs/VNIs and leaf1 has no remote VTEP peers in this two-leaf-VSX-pair fixture', () => {
    const leaf = generateSwitchConfig('leaf1', project, ipPlan)
    const spine = generateSwitchConfig('spine1', project, ipPlan)
    // leaf1's only other VLAN-10/20 carrier is leaf2, which is excluded as its own VSX peer
    // (shared VTEP via ISL, not a remote tunnel) — spines correctly carry no VLANs at all.
    expect(leaf).not.toContain('remote-vtep')
    expect(leaf).toContain('No remote VTEP peers found')
    expect(spine).not.toContain('vlan 10')
    expect(spine).not.toContain('interface vxlan')
  })
})
