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
  if (own) return withMasterSku(own, shapeEl)
  const nested = Array.from(shapeEl.getElementsByTagName('Shape'))
  for (const child of nested) {
    const text = directTextLabel(child)
    if (text) return withMasterSku(text, shapeEl)
  }
  return withMasterSku('', shapeEl)
}

/**
 * Stencil instances (dragged from a master/SKU stencil, e.g. Aruba/HPE
 * product shapes) carry the master's part number directly on the shape as
 * `NameU`, separately from whatever text the user typed into the shape
 * (often a room/rack label, not the model). Surface it so both the catalog
 * matcher and the review UI have a shot at the real part number even when
 * the visible text doesn't mention it.
 */
function withMasterSku(text: string, shapeEl: Element): string {
  const sku = shapeEl.getAttribute('NameU')
  if (!sku || sku === 'Dynamic connector') return text
  if (!text) return sku
  return text.toUpperCase().includes(sku.toUpperCase()) ? text : `${text} [${sku}]`
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

/**
 * Visio's own page numbering (visio/pages/pages.xml, resolved through its
 * .rels to actual page1.xml/page2.xml/... targets) is the only reliable way
 * to find the real first foreground page — `page1.xml` is just a storage
 * filename and is NOT guaranteed to be the diagram the user sees first. In
 * particular, background/title-block pages (Background="1") are common and
 * are not part of the diagram content at all. Falls back to naive filename
 * sorting when pages.xml is missing or unparseable.
 */
async function selectContentPages(zip: JSZip): Promise<{ paths: string[]; multiple: boolean }> {
  const naiveFallback = () => {
    const entries = findPageXmlEntries(zip)
    return { paths: entries, multiple: entries.length > 1 }
  }

  const pagesXmlFile = zip.file('visio/pages/pages.xml')
  const relsFile = zip.file('visio/pages/_rels/pages.xml.rels')
  if (!pagesXmlFile || !relsFile) return naiveFallback()

  try {
    const [pagesXmlText, relsXmlText] = await Promise.all([pagesXmlFile.async('string'), relsFile.async('string')])
    const pagesDoc = new DOMParser().parseFromString(pagesXmlText, 'application/xml')
    const relsDoc = new DOMParser().parseFromString(relsXmlText, 'application/xml')
    if (pagesDoc.getElementsByTagName('parsererror').length > 0 || relsDoc.getElementsByTagName('parsererror').length > 0) {
      return naiveFallback()
    }

    const relIdToTarget = new Map<string, string>()
    for (const rel of Array.from(relsDoc.getElementsByTagName('Relationship'))) {
      const id = rel.getAttribute('Id')
      const target = rel.getAttribute('Target')
      if (id && target) relIdToTarget.set(id, target)
    }

    const contentPagePaths: string[] = []
    for (const pageEl of Array.from(pagesDoc.getElementsByTagName('Page'))) {
      if (pageEl.getAttribute('Background') === '1') continue
      const relEl = Array.from(pageEl.children).find((c) => c.tagName === 'Rel')
      const relId =
        relEl?.getAttribute('r:id') ??
        relEl?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ??
        undefined
      const target = relId ? relIdToTarget.get(relId) : undefined
      if (target) contentPagePaths.push(`visio/pages/${target}`)
    }

    if (contentPagePaths.length === 0) return naiveFallback()
    return { paths: contentPagePaths, multiple: contentPagePaths.length > 1 }
  } catch {
    return naiveFallback()
  }
}

export async function parseVsdxFile(data: ArrayBuffer): Promise<ParsedDiagram> {
  const zip = await JSZip.loadAsync(data)
  const { paths: pageEntries, multiple } = await selectContentPages(zip)
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
  // Only exclude shapes that resolved into a real two-endpoint connector.
  // A shape can appear as FromSheet in <Connects> without being a network
  // link — e.g. a device glued to another device for rack-stack alignment,
  // which yields Begin/End cells pointing at the SAME shape and should stay
  // a switch candidate rather than vanish as a bogus self-loop connector.
  const connectorShapeIds = new Set(connectors.map((c) => c.id))

  const shapes: ParsedShape[] = []
  for (const shapeEl of topLevelShapes) {
    const id = shapeEl.getAttribute('ID')
    if (!id || connectorShapeIds.has(id)) continue
    const xIn = toInches(cellValue(shapeEl, 'PinX'), unitHint)
    const yIn = toInches(cellValue(shapeEl, 'PinY'), unitHint)
    const label = extractLabel(shapeEl)
    shapes.push({ id, label, xIn, yIn })
  }

  return { shapes, connectors, pageWidthIn, pageHeightIn, truncatedToFirstPage: multiple }
}
