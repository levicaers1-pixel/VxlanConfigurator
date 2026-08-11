export interface ParsedShape {
  /** Shape ID as it appears in the Visio page XML — unique within the page. */
  id: string
  label: string
  /** Stencil master part number (Visio's `NameU`), when this shape is an instance of a product stencil — a much more reliable "same real-world model" signal than the free-text label. */
  sku?: string
  /** Page-space position in inches, Visio's native unit regardless of display unit. */
  xIn: number
  yIn: number
}

export interface ParsedConnector {
  id: string
  fromShapeId: string
  toShapeId: string
}

export interface ParsedDiagram {
  shapes: ParsedShape[]
  connectors: ParsedConnector[]
  /** Page size in inches — Visio's Y axis increases upward from the bottom, so consumers converting to screen space need this to flip it. */
  pageWidthIn: number
  pageHeightIn: number
  /** True when the .vsdx had more than one page — only the first page is parsed. */
  truncatedToFirstPage: boolean
}
