import { SWITCH_CATALOG } from '../../domain/catalog'
import type { SwitchCatalogEntry, SwitchRole } from '../../domain/types'

export interface CatalogMatch {
  /** Set only on a confident full-model-string match; otherwise the caller should prompt the user to pick one. */
  entry?: SwitchCatalogEntry
  role: SwitchRole
  confidence: 'high' | 'low'
}

const ROLE_KEYWORDS: [RegExp, SwitchRole][] = [
  [/\bspine\b/i, 'spine'],
  [/\bleaf\b/i, 'leaf'],
  [/\bborder\b/i, 'border'],
  [/\baccess\b/i, 'access'],
  [/\bstandalone\b/i, 'standalone'],
]

function normalize(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function inferRole(label: string, entry: SwitchCatalogEntry | undefined): SwitchRole {
  for (const [pattern, role] of ROLE_KEYWORDS) {
    if (pattern.test(label)) return role
  }
  return entry?.suitableRoles[0] ?? 'standalone'
}

/**
 * Matches a Visio shape's text label against the switch catalog by looking
 * for a full model string as a substring (normalized to strip spaces/dashes)
 * — conservative on purpose, since a wrong high-confidence guess is worse
 * than an honest "couldn't tell, please pick one" for a real fabric design.
 */
export function matchShapeToCatalog(label: string): CatalogMatch {
  const norm = normalize(label)
  let entry: SwitchCatalogEntry | undefined
  if (norm) {
    entry = SWITCH_CATALOG.find((candidate) => {
      const modelNorm = normalize(candidate.model)
      return modelNorm.length > 0 && norm.includes(modelNorm)
    })
  }
  return { entry, role: inferRole(label, entry), confidence: entry ? 'high' : 'low' }
}

/** Best default catalog entry for a role when the label didn't match anything — first catalog entry that supports the role. */
export function defaultCatalogIdForRole(role: SwitchRole): string | undefined {
  return SWITCH_CATALOG.find((c) => c.suitableRoles.includes(role))?.id
}

/** Picks a short device name out of a multi-line label (e.g. "Spine1\n8325-32C" -> "Spine1"), skipping lines that are just the matched model string. */
export function deriveDeviceName(label: string, entry: SwitchCatalogEntry | undefined): string | undefined {
  const modelNorm = entry ? normalize(entry.model) : ''
  const lines = label
    .split(/[\n,]/)
    .map((l) => l.trim())
    .filter(Boolean)
  const candidate = lines.find((line) => {
    const lineNorm = normalize(line)
    if (!lineNorm) return false
    if (modelNorm && lineNorm === modelNorm) return false
    return true
  })
  return candidate?.slice(0, 40)
}
