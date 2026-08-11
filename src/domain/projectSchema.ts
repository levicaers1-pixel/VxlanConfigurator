import { z } from 'zod'

const switchRoleSchema = z.enum(['spine', 'leaf', 'border', 'access', 'standalone'])
const linkKindSchema = z.enum(['underlay-p2p', 'vsx-isl', 'vsx-keepalive', 'mgmt', 'unassigned'])

const portGroupSchema = z.object({
  count: z.number(),
  speedGbps: z.union([z.literal(1), z.literal(10), z.literal(25), z.literal(40), z.literal(100), z.literal(400)]),
  namePrefix: z.string(),
  startIndex: z.number(),
})

const switchCatalogEntrySchema = z.object({
  id: z.string(),
  vendor: z.enum(['Aruba', 'Custom']),
  series: z.enum([
    'CX 6200',
    'CX 6300',
    'CX 8100',
    'CX 8320',
    'CX 8325',
    'CX 8325H',
    'CX 8360',
    'CX 8400',
    'CX 9300',
    'Custom',
  ]),
  model: z.string(),
  suitableRoles: z.array(switchRoleSchema),
  portGroups: z.array(portGroupSchema),
  supportsVsx: z.boolean(),
  supportsEvpn: z.boolean(),
  maxVlans: z.number().optional(),
  notes: z.string().optional(),
  custom: z.boolean().optional(),
})

const switchInstanceSchema = z.object({
  id: z.string(),
  catalogId: z.string(),
  name: z.string(),
  role: switchRoleSchema,
  sequence: z.number(),
  vsxGroupId: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }),
  managementIp: z.string().optional(),
  managementGateway: z.string().optional(),
  asnOverride: z.number().optional(),
  loopbackOverride: z.string().optional(),
})

const portRefSchema = z.object({ switchInstanceId: z.string(), portName: z.string() })

const linkSchema = z.object({
  id: z.string(),
  a: portRefSchema,
  b: portRefSchema,
  kind: linkKindSchema,
  ipOverride: z
    .object({ aIp: z.string(), bIp: z.string(), prefixLen: z.union([z.literal(31), z.literal(30)]) })
    .optional(),
})

const vlanMappingSchema = z.object({
  id: z.string(),
  vlanId: z.number(),
  name: z.string(),
  vniOverride: z.number().optional(),
  vrfId: z.string().optional(),
  subnetOverride: z.string().optional(),
  activeGatewayMacOverride: z.string().optional(),
  presentOn: z.array(z.string()).optional(),
})

const tenantVrfSchema = z.object({
  id: z.string(),
  name: z.string(),
  l3VniOverride: z.number().optional(),
  routeDistinguisherOverride: z.string().optional(),
  importRouteTargets: z.array(z.string()).optional(),
  exportRouteTargets: z.array(z.string()).optional(),
})

const hostConnectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  ports: z.array(portRefSchema).min(1).max(2),
  mode: z.enum(['access', 'trunk']),
  accessVlanId: z.number().optional(),
  trunkNativeVlanId: z.number().optional(),
  trunkAllowedVlans: z.union([z.literal('all'), z.array(z.number())]).optional(),
})

const ipPoolSchema = z.object({ supernet: z.string(), description: z.string().optional() })

const baselineSchema = z.object({
  ntpServers: z.array(z.string()).default([]),
  syslogServers: z.array(z.string()).default([]),
  aaaLocalFallback: z.boolean().default(true),
  bannerText: z.string().optional(),
})

const projectSettingsSchema = z.object({
  fabricMode: z.enum(['static-vxlan', 'evpn']),
  underlayProtocol: z.enum(['ebgp', 'ospf']),
  asnScheme: z.enum(['per-device-unique', 'shared-leaf-asn']),
  baseAsn: z.number(),
  ospfProcessId: z.number().optional(),
  ospfArea: z.string().optional(),
  pools: z.object({
    underlayP2P: ipPoolSchema,
    loopback: ipPoolSchema,
    vsxKeepalive: ipPoolSchema,
    mgmt: ipPoolSchema,
    tenantSubnets: ipPoolSchema,
  }),
  tenantSubnetPrefixLen: z.number(),
  vniAllocation: z.object({
    l2VniStrategy: z.enum(['vlan-plus-offset', 'explicit-pool']),
    l2VniOffset: z.number(),
    l3VniPoolStart: z.number(),
  }),
  routeTargetAsn: z.number().optional(),
  jumboMtu: z.boolean(),
  baseline: baselineSchema.default({ ntpServers: [], syslogServers: [], aaaLocalFallback: true }),
  bgpAuthPassword: z.string().optional(),
})

export const projectSchema = z.object({
  formatVersion: z.literal(1),
  projectName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  settings: projectSettingsSchema,
  switches: z.array(switchInstanceSchema),
  links: z.array(linkSchema),
  vlans: z.array(vlanMappingSchema),
  vrfs: z.array(tenantVrfSchema),
  hostConnections: z.array(hostConnectionSchema).default([]),
  customCatalogEntries: z.array(switchCatalogEntrySchema).default([]),
})

export type ProjectSchemaType = z.infer<typeof projectSchema>
