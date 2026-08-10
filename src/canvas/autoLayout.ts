import type { SwitchInstance, SwitchRole } from '../domain/types'

const ROW_ORDER: SwitchRole[] = ['spine', 'border', 'leaf', 'standalone']
const ROW_HEIGHT = 220
const COLUMN_WIDTH = 220
const CENTER_X = 400
const START_Y = 60

/**
 * Simple layered layout: one row per role (spine on top, leaves below,
 * border/standalone interleaved), switches spread evenly left-to-right
 * within their row in current sequence order. VSX-paired switches are kept
 * adjacent to each other for readability.
 */
export function computeAutoLayout(switches: SwitchInstance[]): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {}

  for (let rowIndex = 0; rowIndex < ROW_ORDER.length; rowIndex++) {
    const role = ROW_ORDER[rowIndex]
    const rowSwitches = switches.filter((s) => s.role === role)

    // Group VSX pairs together so partners land next to each other.
    const seen = new Set<string>()
    const ordered: SwitchInstance[] = []
    for (const sw of rowSwitches.sort((a, b) => a.sequence - b.sequence)) {
      if (seen.has(sw.id)) continue
      ordered.push(sw)
      seen.add(sw.id)
      if (sw.vsxGroupId) {
        const partner = rowSwitches.find((s) => s.vsxGroupId === sw.vsxGroupId && s.id !== sw.id)
        if (partner && !seen.has(partner.id)) {
          ordered.push(partner)
          seen.add(partner.id)
        }
      }
    }

    const rowWidth = (ordered.length - 1) * COLUMN_WIDTH
    const rowStartX = CENTER_X - rowWidth / 2
    ordered.forEach((sw, i) => {
      positions[sw.id] = {
        x: rowStartX + i * COLUMN_WIDTH,
        y: START_Y + rowIndex * ROW_HEIGHT,
      }
    })
  }

  return positions
}
