import type {
  AllocationError,
  IpAllocationResult,
  Link,
  Project,
  SwitchInstance,
  SwitchRole,
  VlanMapping,
} from '../domain/types'
import { carve, cidrToString, intToIp, parseCidr, pointToPointUsable } from './cidr'

const ROLE_PRIORITY: Record<SwitchRole, number> = {
  spine: 0,
  leaf: 1,
  border: 2,
  access: 3,
  standalone: 4,
}

function sortSwitches(switches: SwitchInstance[]): SwitchInstance[] {
  return [...switches].sort((a, b) => {
    const roleDiff = ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role]
    if (roleDiff !== 0) return roleDiff
    return a.sequence - b.sequence
  })
}

/**
 * Global topology order index: role priority first, then per-role sequence.
 * Raw `sequence` alone is only comparable within the same role, so every
 * cross-role ordering decision (link sort, p2p address assignment) must go
 * through this instead of comparing `.sequence` directly.
 */
function globalOrderMap(sortedSwitches: SwitchInstance[]): Map<string, number> {
  return new Map(sortedSwitches.map((s, idx) => [s.id, idx]))
}

function sortLinksByKind(
  links: Link[],
  kind: Link['kind'],
  order: Map<string, number>,
): Link[] {
  return links
    .filter((l) => l.kind === kind)
    .sort((l1, l2) => {
      const a1 = order.get(l1.a.switchInstanceId) ?? 0
      const b1 = order.get(l1.b.switchInstanceId) ?? 0
      const a2 = order.get(l2.a.switchInstanceId) ?? 0
      const b2 = order.get(l2.b.switchInstanceId) ?? 0
      const min1 = Math.min(a1, b1)
      const max1 = Math.max(a1, b1)
      const min2 = Math.min(a2, b2)
      const max2 = Math.max(a2, b2)
      if (min1 !== min2) return min1 - min2
      if (max1 !== max2) return max1 - max2
      return l1.a.portName.localeCompare(l2.a.portName)
    })
}

function sortVlans(vlans: VlanMapping[]): VlanMapping[] {
  return [...vlans].sort((a, b) => a.vlanId - b.vlanId)
}

export function computeIpPlan(project: Project): IpAllocationResult {
  const errors: AllocationError[] = []
  const { settings } = project
  const sortedSwitches = sortSwitches(project.switches)
  const order = globalOrderMap(sortedSwitches)
  // Access switches sit outside the VXLAN fabric — they don't need a VTEP
  // loopback or an underlay ASN, only OOB management (handled separately below).
  const fabricSwitches = sortedSwitches.filter((s) => s.role !== 'access')

  // ---------- Loopbacks ----------
  const loopbacks: Record<string, string> = {}
  {
    const gen = carve(settings.pools.loopback.supernet, 32)
    for (const sw of fabricSwitches) {
      if (sw.loopbackOverride) {
        loopbacks[sw.id] = sw.loopbackOverride
        continue
      }
      const next = gen.next()
      if (next.done) {
        errors.push({
          severity: 'error',
          scope: 'loopback',
          refId: sw.id,
          message: `Loopback pool ${settings.pools.loopback.supernet} exhausted — no address available for ${sw.name}`,
        })
        continue
      }
      loopbacks[sw.id] = intToIp(next.value)
    }
  }

  // ---------- Management IPs (every switch, including access role) ----------
  const mgmtIps: Record<string, string> = {}
  let mgmtGateway = ''
  {
    const { network, prefixLen } = (() => {
      try {
        return parseCidr(settings.pools.mgmt.supernet)
      } catch {
        return { network: 0, prefixLen: 32 }
      }
    })()
    mgmtGateway = intToIp((network + 1) >>> 0)
    const gen = carve(settings.pools.mgmt.supernet, 32)
    gen.next() // skip .0 (network)
    gen.next() // skip .1 (reserved for gateway)
    for (const sw of sortedSwitches) {
      if (sw.managementIp) {
        mgmtIps[sw.id] = sw.managementIp
        continue
      }
      const next = gen.next()
      if (next.done) {
        errors.push({
          severity: 'warning',
          scope: 'loopback',
          refId: sw.id,
          message: `Management pool ${settings.pools.mgmt.supernet} exhausted — no address available for ${sw.name}`,
        })
        continue
      }
      mgmtIps[sw.id] = `${intToIp(next.value)}/${prefixLen}`
    }
  }

  // ---------- Underlay P2P links ----------
  const underlayLinkIps: IpAllocationResult['underlayLinkIps'] = {}
  {
    const underlayLinks = sortLinksByKind(project.links, 'underlay-p2p', order)
    const gen = carve(settings.pools.underlayP2P.supernet, 31)
    for (const link of underlayLinks) {
      if (link.ipOverride) {
        underlayLinkIps[link.id] = {
          aIp: link.ipOverride.aIp,
          bIp: link.ipOverride.bIp,
          prefixLen: link.ipOverride.prefixLen,
        }
        continue
      }
      const next = gen.next()
      if (next.done) {
        errors.push({
          severity: 'error',
          scope: 'underlay',
          refId: link.id,
          message: `Underlay pool ${settings.pools.underlayP2P.supernet} exhausted — no /31 available for link ${link.id}`,
        })
        continue
      }
      const [ip0, ip1] = pointToPointUsable(next.value, 31)
      const aLower = (order.get(link.a.switchInstanceId) ?? 0) <= (order.get(link.b.switchInstanceId) ?? 0)
      underlayLinkIps[link.id] = {
        aIp: intToIp(aLower ? ip0 : ip1),
        bIp: intToIp(aLower ? ip1 : ip0),
        prefixLen: 31,
      }
    }
  }

  // ---------- VSX keepalive ----------
  const vsxKeepalives: IpAllocationResult['vsxKeepalives'] = {}
  {
    const groups = new Map<string, SwitchInstance[]>()
    for (const sw of sortedSwitches) {
      if (!sw.vsxGroupId) continue
      const arr = groups.get(sw.vsxGroupId) ?? []
      arr.push(sw)
      groups.set(sw.vsxGroupId, arr)
    }
    const orderedGroupIds = [...groups.keys()].sort((g1, g2) => {
      const min1 = Math.min(...groups.get(g1)!.map((s) => order.get(s.id) ?? 0))
      const min2 = Math.min(...groups.get(g2)!.map((s) => order.get(s.id) ?? 0))
      return min1 - min2
    })
    const gen = carve(settings.pools.vsxKeepalive.supernet, 31)
    for (const groupId of orderedGroupIds) {
      const members = groups.get(groupId)!.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      if (members.length !== 2) {
        errors.push({
          severity: 'warning',
          scope: 'vsx',
          refId: groupId,
          message: `VSX group ${groupId} has ${members.length} member(s); expected exactly 2`,
        })
      }
      const next = gen.next()
      if (next.done) {
        errors.push({
          severity: 'error',
          scope: 'vsx',
          refId: groupId,
          message: `VSX keepalive pool ${settings.pools.vsxKeepalive.supernet} exhausted — no /31 available for VSX group ${groupId}`,
        })
        continue
      }
      const [ip0, ip1] = pointToPointUsable(next.value, 31)
      vsxKeepalives[groupId] = {
        primaryIp: intToIp(ip0),
        secondaryIp: intToIp(ip1),
        primarySwitchId: members[0]?.id ?? '',
        secondarySwitchId: members[1]?.id ?? members[0]?.id ?? '',
      }
    }
  }

  // ---------- Tenant subnets ----------
  const tenantSubnets: Record<string, string> = {}
  {
    const vlans = sortVlans(project.vlans)
    const gen = carve(settings.pools.tenantSubnets.supernet, settings.tenantSubnetPrefixLen)
    for (const vlan of vlans) {
      if (vlan.subnetOverride) {
        tenantSubnets[vlan.id] = vlan.subnetOverride
        continue
      }
      const next = gen.next()
      if (next.done) {
        errors.push({
          severity: 'error',
          scope: 'vlan',
          refId: vlan.id,
          message: `Tenant subnet pool ${settings.pools.tenantSubnets.supernet} exhausted — no /${settings.tenantSubnetPrefixLen} available for VLAN ${vlan.vlanId}`,
        })
        continue
      }
      tenantSubnets[vlan.id] = cidrToString(next.value, settings.tenantSubnetPrefixLen)
    }
  }

  // ---------- VNIs ----------
  const l2Vnis: Record<string, number> = {}
  {
    const vlans = sortVlans(project.vlans)
    let explicitCursor = settings.vniAllocation.l2VniOffset
    for (const vlan of vlans) {
      if (vlan.vniOverride !== undefined) {
        l2Vnis[vlan.id] = vlan.vniOverride
        continue
      }
      if (settings.vniAllocation.l2VniStrategy === 'explicit-pool') {
        l2Vnis[vlan.id] = explicitCursor
        explicitCursor += 1
      } else {
        l2Vnis[vlan.id] = vlan.vlanId + settings.vniAllocation.l2VniOffset
      }
    }
  }

  const l3Vnis: Record<string, number> = {}
  {
    const sortedVrfs = [...project.vrfs].sort((a, b) => a.name.localeCompare(b.name))
    sortedVrfs.forEach((vrf, idx) => {
      l3Vnis[vrf.id] = vrf.l3VniOverride ?? settings.vniAllocation.l3VniPoolStart + idx
    })
  }

  // ---------- ASNs ----------
  const asns: Record<string, number> = {}
  {
    if (settings.asnScheme === 'per-device-unique') {
      fabricSwitches.forEach((sw, idx) => {
        asns[sw.id] = sw.asnOverride ?? settings.baseAsn + idx + 1
      })
    } else {
      // shared-leaf-asn: spines get unique ASNs; VSX-paired (or standalone) leaves
      // share one ASN per VSX group / per standalone switch.
      const spines = fabricSwitches.filter((s) => s.role === 'spine')
      spines.forEach((sw, idx) => {
        asns[sw.id] = sw.asnOverride ?? settings.baseAsn + idx + 1
      })
      const nonSpines = fabricSwitches.filter((s) => s.role !== 'spine')
      const groupAsn = new Map<string, number>()
      let leafCounter = 0
      for (const sw of nonSpines) {
        if (sw.asnOverride !== undefined) {
          asns[sw.id] = sw.asnOverride
          continue
        }
        const key = sw.vsxGroupId ?? sw.id
        if (!groupAsn.has(key)) {
          leafCounter += 1
          groupAsn.set(key, settings.baseAsn + 100 + leafCounter)
        }
        asns[sw.id] = groupAsn.get(key)!
      }
    }
  }

  return {
    underlayLinkIps,
    loopbacks,
    mgmtIps,
    mgmtGateway,
    vsxKeepalives,
    tenantSubnets,
    l2Vnis,
    l3Vnis,
    asns,
    errors,
  }
}
