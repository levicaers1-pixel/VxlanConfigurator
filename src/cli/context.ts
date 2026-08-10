import type { IpAllocationResult, Link, Project, SwitchCatalogEntry, SwitchInstance, VlanMapping } from '../domain/types'
import type { ConfigBuilder } from './ConfigBuilder'

export interface SwitchConfigContext {
  project: Project
  ipPlan: IpAllocationResult
  self: SwitchInstance
  catalogEntry: SwitchCatalogEntry
  peerLinks: Link[]
  vsxPeer?: SwitchInstance
}

export type SectionBuilder = (ctx: SwitchConfigContext, out: ConfigBuilder) => void

/** Returns the port name on `self`'s side of `link`. */
export function ownPort(ctx: SwitchConfigContext, link: Link): string {
  return link.a.switchInstanceId === ctx.self.id ? link.a.portName : link.b.portName
}

/** Returns the switch instance at the other end of `link` from `self`. */
export function peerSwitch(ctx: SwitchConfigContext, link: Link): SwitchInstance | undefined {
  const peerId = link.a.switchInstanceId === ctx.self.id ? link.b.switchInstanceId : link.a.switchInstanceId
  return ctx.project.switches.find((s) => s.id === peerId)
}

/** Returns { ownIp, peerIp, prefixLen } for an underlay-p2p link from self's perspective. */
export function ownAndPeerIp(
  ctx: SwitchConfigContext,
  link: Link,
): { ownIp: string; peerIp: string; prefixLen: number } | undefined {
  const ip = ctx.ipPlan.underlayLinkIps[link.id]
  if (!ip) return undefined
  const selfIsA = link.a.switchInstanceId === ctx.self.id
  return { ownIp: selfIsA ? ip.aIp : ip.bIp, peerIp: selfIsA ? ip.bIp : ip.aIp, prefixLen: ip.prefixLen }
}

/** VLANs present on an arbitrary switch id: explicit presentOn list, or all VLANs if unset (defaults to "all leaves"). */
export function vlansPresentOn(vlans: VlanMapping[], switchId: string): VlanMapping[] {
  return vlans.filter((v) => !v.presentOn || v.presentOn.length === 0 || v.presentOn.includes(switchId))
}

/** VLANs present on this switch: explicit presentOn list, or all VLANs if unset (defaults to "all leaves"). */
export function vlansOnSwitch(ctx: SwitchConfigContext) {
  return vlansPresentOn(ctx.project.vlans, ctx.self.id)
}

/** VRFs that have at least one VLAN present on this switch. */
export function vrfsOnSwitch(ctx: SwitchConfigContext) {
  const vrfIds = new Set(vlansOnSwitch(ctx).map((v) => v.vrfId).filter((id): id is string => !!id))
  return ctx.project.vrfs.filter((v) => vrfIds.has(v.id))
}
