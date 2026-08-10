import type { SwitchCatalogEntry } from './types'

export function listPorts(entry: SwitchCatalogEntry): string[] {
  const ports: string[] = []
  for (const group of entry.portGroups) {
    for (let i = 0; i < group.count; i++) {
      ports.push(`${group.namePrefix}${group.startIndex + i}`)
    }
  }
  return ports
}

export function nextAvailablePort(entry: SwitchCatalogEntry, usedPorts: Set<string>): string | undefined {
  return listPorts(entry).find((p) => !usedPorts.has(p))
}
