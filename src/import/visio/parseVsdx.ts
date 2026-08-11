import JSZip from 'jszip'
import type { ParsedConnector, ParsedDiagram, ParsedShape } from './types'

const INCHES_PER_METER = 39.3700787

function cellValue(shapeEl: Element, name: string): string | undefined {
  for (const child of Array.from(shapeEl.children)) {
    if (child.tagName === 'Cell' && child.getAttribute('N') === name) {
      return child.getAttribute('V') ?? undefined
    }
  }
  return undefined
}

function directTextLabel(shapeEl: Element): string {
  for (const child of Array.from(shapeEl.children)) {
    if (child.tagName === 'Text') return (child.textContent ?? '').trim()
  }
  return ''
}

/** Falls back to the first non-empty label found on a descendant shape (grouped stencils often carry the visible text on a nested sub-shape). */
function extractLabel(shapeEl: Element): string {
  const own = directTextLabel(shapeEl)
  if (own) return own
  const nested = Array.from(shapeEl.getElementsByTagName('Shape'))
  for (const child of nested) {
    const text = directTextLabel(child)
    if (text) return text
  }
  return ''
}

/** Visio stores PinX/PinY in inches by default, or in meters when the document uses metric page properties (rare but seen in some exports). */
function toInches(raw: string | undefined, unitHint: 'IN' | 'M'): number {
  const value = Number(raw)
  if (!Number.isFinite(value)) return 0
  return unitHint === 'M' ? value * INCHES_PER_METER : value
}

function findPageXmlEntries(zip: JSZip): string[] {
  return Object.keys(zip.files)
    .filter((name) => /^visio\/pages\/page\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/page(\d+)\.xml$/i)?.[1] ?? 0)
      const nb = Number(b.match(/page(\d+)\.xml$/i)?.[1] ?? 0)
      return na - nb
    })
}

export async function parseVsdxFile(data: ArrayBuffer): Promise<ParsedDiagram> {
  const zip = await JSZip.loadAsync(data)
  const pageEntries = findPageXmlEntries(zip)
  if (pageEntries.length === 0) {
    throw new Error('No page content found — this file doesn’t look like a valid .vsdx (Visio 2013+ XML format).')
  }

  const xmlText = await zip.file(pageEntries[0])!.async('string')
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Could not parse the Visio page XML — the file may be corrupt.')
  }

  const pageContents = doc.documentElement
  const shapesRoot = Array.from(pageContents.children).find((c) => c.tagName === 'Shapes')
  const connectsRoot = Array.from(pageContents.children).find((c) => c.tagName === 'Connects')

  // Unit hint: metric documents mark the page sheet's PageWidth cell with a Unit attribute of "M".
  const pageSheet = Array.from(pageContents.children).find((c) => c.tagName === 'PageSheet')
  const widthCell = pageSheet && Array.from(pageSheet.children).find((c) => c.tagName === 'Cell' && c.getAttribute('N') === 'PageWidth')
  const heightCell = pageSheet && Array.from(pageSheet.children).find((c) => c.tagName === 'Cell' && c.getAttribute('N') === 'PageHeight')
  const unitHint: 'IN' | 'M' = widthCell?.getAttribute('U') === 'M' ? 'M' : 'IN'
  const pageWidthIn = toInches(widthCell?.getAttribute('V') ?? undefined, unitHint) || 11
  const pageHeightIn = toInches(heightCell?.getAttribute('V') ?? undefined, unitHint) || 8.5

  // Only top-level shapes are treated as switch/connector candidates — nested
  // Shape elements inside a group are the group's visual sub-parts, not
  // independent diagram nodes.
  const topLevelShapes = shapesRoot ? Array.from(shapesRoot.children).filter((c) => c.tagName === 'Shape') : []

  // A connector is any shape whose ID appears as FromSheet with BeginX/EndX
  // cells in <Connects> — build begin/end endpoint pairs from that.
  const connectorEndpoints = new Map<string, { beginShapeId?: string; endShapeId?: string }>()
  if (connectsRoot) {
    for (const connect of Array.from(connectsRoot.children)) {
      if (connect.tagName !== 'Connect') continue
      const fromSheet = connect.getAttribute('FromSheet')
      const fromCell = connect.getAttribute('FromCell')
      const toSheet = connect.getAttribute('ToSheet')
      if (!fromSheet || !toSheet) continue
      const entry = connectorEndpoints.get(fromSheet) ?? {}
      if (fromCell === 'BeginX') entry.beginShapeId = toSheet
      else if (fromCell === 'EndX') entry.endShapeId = toSheet
      connectorEndpoints.set(fromSheet, entry)
    }
  }

  const connectors: ParsedConnector[] = []
  for (const [connectorId, { beginShapeId, endShapeId }] of connectorEndpoints) {
    if (beginShapeId && endShapeId && beginShapeId !== endShapeId) {
      connectors.push({ id: connectorId, fromShapeId: beginShapeId, toShapeId: endShapeId })
    }
  }
  const connectorShapeIds = new Set(connectorEndpoints.keys())

  const shapes: ParsedShape[] = []
  for (const shapeEl of topLevelShapes) {
    const id = shapeEl.getAttribute('ID')
    if (!id || connectorShapeIds.has(id)) continue
    const xIn = toInches(cellValue(shapeEl, 'PinX'), unitHint)
    const yIn = toInches(cellValue(shapeEl, 'PinY'), unitHint)
    const label = extractLabel(shapeEl)
    shapes.push({ id, label, xIn, yIn })
  }

  return { shapes, connectors, pageWidthIn, pageHeightIn, truncatedToFirstPage: pageEntries.length > 1 }
}
