import { getCatalogEntry } from '../domain/catalog'
import { nextAvailablePort } from '../domain/ports'
import type { Link, SwitchInstance } from '../domain/types'

export interface ConnectCheck {
  ok: boolean
  reason?: string
  portA?: string
  portB?: string
}

function usedPorts(switchId: string, links: Link[]): Set<string> {
  const used = new Set<string>()
  for (const link of links) {
    if (link.a.switchInstanceId === switchId) used.add(link.a.portName)
    if (link.b.switchInstanceId === switchId) used.add(link.b.portName)
  }
  return used
}

export function checkConnect(switchA: SwitchInstance, switchB: SwitchInstance, links: Link[]): ConnectCheck {
  if (switchA.id === switchB.id) {
    return { ok: false, reason: 'Cannot link a switch to itself' }
  }
  const entryA = getCatalogEntry(switchA.catalogId)
  const entryB = getCatalogEntry(switchB.catalogId)
  if (!entryA || !entryB) {
    return { ok: false, reason: 'Unknown switch catalog entry' }
  }
  const portA = nextAvailablePort(entryA, usedPorts(switchA.id, links))
  const portB = nextAvailablePort(entryB, usedPorts(switchB.id, links))
  if (!portA) {
    return { ok: false, reason: `${switchA.name} has no free ports left` }
  }
  if (!portB) {
    return { ok: false, reason: `${switchB.name} has no free ports left` }
  }
  return { ok: true, portA, portB }
}
