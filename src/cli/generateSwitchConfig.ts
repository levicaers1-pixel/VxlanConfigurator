import type { IpAllocationResult, Project } from '../domain/types'
import { getCatalogEntry } from '../domain/catalog'
import { ConfigBuilder } from './ConfigBuilder'
import type { SectionBuilder, SwitchConfigContext } from './context'
import { spineEvpn } from './recipes/spineEvpn'
import { leafEvpnVsx } from './recipes/leafEvpnVsx'
import { staticVxlan } from './recipes/staticVxlan'
import { accessSwitch } from './recipes/accessSwitch'

function pickRecipe(ctx: SwitchConfigContext): SectionBuilder[] {
  // Access switches are never fabric/VXLAN participants, regardless of fabric mode.
  if (ctx.self.role === 'access') return accessSwitch
  if (ctx.project.settings.fabricMode === 'static-vxlan') return staticVxlan
  if (ctx.self.role === 'spine') return spineEvpn
  return leafEvpnVsx
}

export function buildContext(switchId: string, project: Project, ipPlan: IpAllocationResult): SwitchConfigContext {
  const self = project.switches.find((s) => s.id === switchId)
  if (!self) throw new Error(`Unknown switch ${switchId}`)
  const catalogEntry = getCatalogEntry(self.catalogId, project.customCatalogEntries)
  if (!catalogEntry) throw new Error(`Unknown catalog entry ${self.catalogId}`)

  const peerLinks = project.links.filter(
    (l) => l.a.switchInstanceId === self.id || l.b.switchInstanceId === self.id,
  )
  const vsxPeer = self.vsxGroupId
    ? project.switches.find((s) => s.id !== self.id && s.vsxGroupId === self.vsxGroupId)
    : undefined

  return { project, ipPlan, self, catalogEntry, peerLinks, vsxPeer }
}

export function generateSwitchConfig(switchId: string, project: Project, ipPlan: IpAllocationResult): string {
  const ctx = buildContext(switchId, project, ipPlan)
  const recipe = pickRecipe(ctx)
  const out = new ConfigBuilder()
  for (const section of recipe) section(ctx, out)
  return out.toString()
}
