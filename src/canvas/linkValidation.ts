import { getCatalogEntry } from '../domain/catalog'
import type { Link, SwitchInstance } from '../domain/types'

export interface ConnectCheck {
  ok: boolean
  reason?: string
}

function isPortUsed(switchId: string, portName: string, links: Link[], excludeLinkId?: string): boolean {
  return links.some(
    (l) =>
      l.id !== excludeLinkId &&
      ((l.a.switchInstanceId === switchId && l.a.portName === portName) ||
        (l.b.switchInstanceId === switchId && l.b.portName === portName)),
  )
}

/**
 * Validates connecting a specific port on switchA to a specific port on switchB.
 * `excludeLinkId` lets a reconnect check ignore the link being moved.
 */
export function checkConnectPorts(
  switchA: SwitchInstance,
  portA: string,
  switchB: SwitchInstance,
  portB: string,
  links: Link[],
  excludeLinkId?: string,
): ConnectCheck {
  if (switchA.id === switchB.id && portA === portB) {
    return { ok: false, reason: 'Cannot link a port to itself' }
  }
  const entryA = getCatalogEntry(switchA.catalogId)
  const entryB = getCatalogEntry(switchB.catalogId)
  if (!entryA || !entryB) {
    return { ok: false, reason: 'Unknown switch catalog entry' }
  }
  if (isPortUsed(switchA.id, portA, links, excludeLinkId)) {
    return { ok: false, reason: `${switchA.name} port ${portA} is already in use` }
  }
  if (isPortUsed(switchB.id, portB, links, excludeLinkId)) {
    return { ok: false, reason: `${switchB.name} port ${portB} is already in use` }
  }
  return { ok: true }
}
