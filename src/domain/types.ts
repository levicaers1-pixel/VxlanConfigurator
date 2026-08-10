// ---------- Catalog (static, hardcoded, shipped with app) ----------

export type SwitchRole = 'spine' | 'leaf' | 'border' | 'access' | 'standalone'

export type PortSpeedGbps = 1 | 10 | 25 | 40 | 100 | 400

export interface PortGroup {
  count: number
  speedGbps: PortSpeedGbps
  /** e.g. "1/1/" — combined with startIndex to generate real port names like "1/1/1" */
  namePrefix: string
  startIndex: number
}

export interface SwitchCatalogEntry {
  id: string
  vendor: 'Aruba'
  series: 'CX 6200' | 'CX 6300' | 'CX 8320' | 'CX 8325' | 'CX 8325H' | 'CX 8360' | 'CX 8400' | 'CX 9300'
  model: string
  suitableRoles: SwitchRole[]
  portGroups: PortGroup[]
  supportsVsx: boolean
  supportsEvpn: boolean
  maxVlans?: number
  notes?: string
}

// ---------- Placed instances on the canvas ----------

export interface SwitchInstance {
  id: string
  catalogId: string
  name: string
  role: SwitchRole
  /** stable, per-role sequence number assigned at creation time. Drives deterministic allocation. */
  sequence: number
  vsxGroupId?: string
  position: { x: number; y: number }
  managementIp?: string
  managementGateway?: string
  asnOverride?: number
  loopbackOverride?: string
}

export interface PortRef {
  switchInstanceId: string
  portName: string
}

export type LinkKind = 'underlay-p2p' | 'vsx-isl' | 'vsx-keepalive' | 'mgmt' | 'unassigned'

export interface Link {
  id: string
  a: PortRef
  b: PortRef
  kind: LinkKind
  ipOverride?: { aIp: string; bIp: string; prefixLen: 31 | 30 }
}

// ---------- VLAN / VNI overlay model ----------

export interface TenantVrf {
  id: string
  name: string
  l3VniOverride?: number
  routeDistinguisherOverride?: string
  importRouteTargets?: string[]
  exportRouteTargets?: string[]
}

export interface VlanMapping {
  id: string
  vlanId: number
  name: string
  vniOverride?: number
  vrfId?: string
  subnetOverride?: string
  activeGatewayMacOverride?: string
  /** which switches this VLAN/VNI is present on; empty/undefined means "all leaves" */
  presentOn?: string[]
}

// ---------- Project-level settings (pools, protocol choices) ----------

export interface IpPool {
  supernet: string
  description?: string
}

export type FabricMode = 'static-vxlan' | 'evpn'
export type UnderlayProtocol = 'ebgp' | 'ospf'
export type AsnScheme = 'per-device-unique' | 'shared-leaf-asn'
export type VniStrategy = 'vlan-plus-offset' | 'explicit-pool'

export interface ProjectSettings {
  fabricMode: FabricMode
  underlayProtocol: UnderlayProtocol
  asnScheme: AsnScheme
  baseAsn: number
  ospfProcessId?: number
  ospfArea?: string

  pools: {
    underlayP2P: IpPool
    loopback: IpPool
    vsxKeepalive: IpPool
    mgmt: IpPool
    tenantSubnets: IpPool
  }
  tenantSubnetPrefixLen: number

  vniAllocation: {
    l2VniStrategy: VniStrategy
    l2VniOffset: number
    l3VniPoolStart: number
  }
  routeTargetAsn?: number
  jumboMtu: boolean
}

// ---------- Whole project (the JSON save/load unit) ----------

export interface Project {
  formatVersion: 1
  projectName: string
  createdAt: string
  updatedAt: string
  settings: ProjectSettings
  switches: SwitchInstance[]
  links: Link[]
  vlans: VlanMapping[]
  vrfs: TenantVrf[]
}

// ---------- Derived (NOT persisted — recomputed from Project) ----------

export interface AllocationError {
  severity: 'error' | 'warning'
  scope: 'underlay' | 'loopback' | 'vsx' | 'vlan'
  refId: string
  message: string
}

export interface IpAllocationResult {
  underlayLinkIps: Record<string, { aIp: string; bIp: string; prefixLen: number }>
  loopbacks: Record<string, string>
  /** Auto-allocated from settings.pools.mgmt (CIDR incl. prefix), or the switch's managementIp override verbatim. */
  mgmtIps: Record<string, string>
  /** First usable address in the mgmt pool; shared OOB gateway unless a switch overrides managementGateway. */
  mgmtGateway: string
  vsxKeepalives: Record<string, { primaryIp: string; secondaryIp: string; primarySwitchId: string; secondarySwitchId: string }>
  tenantSubnets: Record<string, string>
  l2Vnis: Record<string, number>
  l3Vnis: Record<string, number>
  asns: Record<string, number>
  errors: AllocationError[]
}
