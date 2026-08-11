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
  // A genuinely unidentified device (no catalog match, no role keyword) defaults
  // to 'access' rather than 'standalone' — 'standalone' gets the full EVPN/VXLAN
  // fabric recipe in this tool's CLI generator, which would fabricate plausible-
  // looking but meaningless config for hardware we know nothing about. 'access'
  // only generates hostname/mgmt/trunk-uplink config — the safe default.
  return entry?.suitableRoles[0] ?? 'access'
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

/**
 * Strips the per-instance decorations this importer adds/encounters so
 * shapes that are really the same real-world model (e.g. every "HPE ANW
 * 2930M 48G PoE+ 1-slot Switch #N" in a diagram) collapse to one shared
 * model name instead of one synthesized catalog entry per instance:
 * the bracketed stencil SKU suffix (already tracked separately), and a
 * trailing "#N" instance counter some diagrams number devices with.
 */
export function deriveModelName(label: string): string {
  return label
    .replace(/\s*\[[^\]]+\]\s*$/, '')
    .replace(/\s*#\d+\s*$/, '')
    .trim()
}

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return slug || 'device'
}

/** Best-effort port count guess from patterns like "48G"/"24-port" in the label — falls back to a generic 24-port pool when nothing matches. */
function guessPortCount(text: string): number {
  const match = text.match(/\b(\d{1,3})\s*G(?:E)?\b/i) ?? text.match(/\b(\d{1,3})[- ]?port/i)
  const n = match ? Number(match[1]) : NaN
  return Number.isFinite(n) && n > 0 && n <= 96 ? n : 24
}

/**
 * Builds a project-local catalog entry for a device that doesn't match the
 * shipped, verified AOS-CX catalog — e.g. a different Aruba product line
 * (ArubaOS-Switch, not AOS-CX) or a third-party switch referenced in an
 * imported diagram. Port count is a rough guess from the label text; the
 * entry is flagged `custom: true` throughout the UI so it's never mistaken
 * for a verified spec.
 */
export function synthesizeCatalogEntry(modelName: string, sku: string | undefined, role: SwitchRole): SwitchCatalogEntry {
  const cleanModel = deriveModelName(modelName) || sku || 'Unknown device'
  const id = `custom-${slugify(sku ?? cleanModel)}`
  const displayModel = sku && !cleanModel.toUpperCase().includes(sku.toUpperCase()) ? `${cleanModel} [${sku}]` : cleanModel
  return {
    id,
    vendor: 'Custom',
    series: 'Custom',
    model: displayModel,
    suitableRoles: [role],
    portGroups: [{ count: guessPortCount(modelName), speedGbps: 1, namePrefix: '1/1/', startIndex: 1 }],
    supportsVsx: false,
    supportsEvpn: false,
    custom: true,
    notes:
      'Auto-added from a Visio import for a model not in the shipped catalog. Port count/speed is a rough guess from the shape label — verify against the real datasheet before generating or trusting CLI for this switch.',
  }
}
