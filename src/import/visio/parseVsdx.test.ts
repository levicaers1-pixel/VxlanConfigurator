import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { parseVsdxFile } from './parseVsdx'

async function buildTestVsdx(pageXmlByPage: string[]): Promise<ArrayBuffer> {
  const zip = new JSZip()
  pageXmlByPage.forEach((xml, idx) => {
    zip.file(`visio/pages/page${idx + 1}.xml`, xml)
  })
  return zip.generateAsync({ type: 'arraybuffer' })
}

/**
 * Mirrors a real Visio export: a Background page listed in pages.xml
 * (storage filename page1.xml) plus the real foreground page (page2.xml),
 * wired through pages.xml.rels — same shape as files exported by actual
 * Visio, where the background page is NOT necessarily page1.xml by storage
 * order and must never be treated as the diagram content.
 */
async function buildVsdxWithBackgroundPage(backgroundPageXml: string, contentPageXml: string): Promise<ArrayBuffer> {
  const zip = new JSZip()
  zip.file('visio/pages/page1.xml', backgroundPageXml)
  zip.file('visio/pages/page2.xml', contentPageXml)
  zip.file(
    'visio/pages/pages.xml',
    `<?xml version='1.0' encoding='utf-8' ?>
<Pages xmlns='http://schemas.microsoft.com/office/visio/2012/main' xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships'>
  <Page ID='1' Background='1' Name='Background'><Rel r:id='rId1'/></Page>
  <Page ID='0' Name='Design'><Rel r:id='rId2'/></Page>
</Pages>`,
  )
  zip.file(
    'visio/pages/_rels/pages.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page2.xml"/>
</Relationships>`,
  )
  return zip.generateAsync({ type: 'arraybuffer' })
}

const BASIC_PAGE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main" xml:space="preserve">
  <PageSheet>
    <Cell N="PageWidth" V="11"/>
    <Cell N="PageHeight" V="8.5"/>
  </PageSheet>
  <Shapes>
    <Shape ID="1" Type="Shape">
      <Cell N="PinX" V="2"/>
      <Cell N="PinY" V="7"/>
      <Text>Spine1
8325-32C</Text>
    </Shape>
    <Shape ID="2" Type="Shape">
      <Cell N="PinX" V="5"/>
      <Cell N="PinY" V="3"/>
      <Text>Leaf1
8325-48Y8C</Text>
    </Shape>
    <Shape ID="3" Type="Shape">
      <Cell N="PinX" V="3.5"/>
      <Cell N="PinY" V="5"/>
      <Cell N="BeginX" V="2"/>
      <Cell N="BeginY" V="7"/>
      <Cell N="EndX" V="5"/>
      <Cell N="EndY" V="3"/>
      <Text></Text>
    </Shape>
  </Shapes>
  <Connects>
    <Connect FromSheet="3" FromCell="BeginX" ToSheet="1" ToCell="PinX"/>
    <Connect FromSheet="3" FromCell="EndX" ToSheet="2" ToCell="PinX"/>
  </Connects>
</PageContents>`

describe('parseVsdxFile', () => {
  it('extracts switch-candidate shapes with label and position, excluding the connector shape', async () => {
    const data = await buildTestVsdx([BASIC_PAGE])
    const result = await parseVsdxFile(data)

    expect(result.shapes).toHaveLength(2)
    const spine = result.shapes.find((s) => s.id === '1')
    const leaf = result.shapes.find((s) => s.id === '2')
    expect(spine?.label).toBe('Spine1\n8325-32C')
    expect(spine?.xIn).toBe(2)
    expect(spine?.yIn).toBe(7)
    expect(leaf?.label).toBe('Leaf1\n8325-48Y8C')
    expect(result.shapes.find((s) => s.id === '3')).toBeUndefined()
  })

  it('resolves the connector to its two endpoint shape IDs', async () => {
    const data = await buildTestVsdx([BASIC_PAGE])
    const result = await parseVsdxFile(data)

    expect(result.connectors).toHaveLength(1)
    expect(result.connectors[0]).toMatchObject({ id: '3', fromShapeId: '1', toShapeId: '2' })
  })

  it('falls back to a nested sub-shape label when the group shape has no direct Text', async () => {
    const groupedPage = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main" xml:space="preserve">
  <PageSheet>
    <Cell N="PageWidth" V="11"/>
    <Cell N="PageHeight" V="8.5"/>
  </PageSheet>
  <Shapes>
    <Shape ID="10" Type="Group">
      <Cell N="PinX" V="1"/>
      <Cell N="PinY" V="1"/>
      <Shapes>
        <Shape ID="11" Type="Shape">
          <Text>Border1 8320-48Y6C</Text>
        </Shape>
      </Shapes>
    </Shape>
  </Shapes>
</PageContents>`
    const data = await buildTestVsdx([groupedPage])
    const result = await parseVsdxFile(data)

    expect(result.shapes).toHaveLength(1)
    expect(result.shapes[0]).toMatchObject({ id: '10', label: 'Border1 8320-48Y6C', xIn: 1, yIn: 1 })
  })

  it('flags truncatedToFirstPage when the file has more than one page', async () => {
    const data = await buildTestVsdx([BASIC_PAGE, BASIC_PAGE])
    const result = await parseVsdxFile(data)
    expect(result.truncatedToFirstPage).toBe(true)
  })

  it('does not flag truncation for a single-page file', async () => {
    const data = await buildTestVsdx([BASIC_PAGE])
    const result = await parseVsdxFile(data)
    expect(result.truncatedToFirstPage).toBe(false)
  })

  it('throws a helpful error when there is no page content at all', async () => {
    const zip = new JSZip()
    zip.file('readme.txt', 'not a visio file')
    const data = await zip.generateAsync({ type: 'arraybuffer' })
    await expect(parseVsdxFile(data)).rejects.toThrow(/valid \.vsdx/)
  })

  it('uses pages.xml to skip a Background page and parse the real foreground page instead, even though the background is stored as page1.xml', async () => {
    const backgroundPage = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main" xml:space="preserve">
  <PageSheet><Cell N="PageWidth" V="11"/><Cell N="PageHeight" V="8.5"/></PageSheet>
  <Shapes>
    <Shape ID="1" Type="Shape"><Cell N="PinX" V="5"/><Cell N="PinY" V="8"/><Text>Block Diagram</Text></Shape>
  </Shapes>
</PageContents>`
    const data = await buildVsdxWithBackgroundPage(backgroundPage, BASIC_PAGE)
    const result = await parseVsdxFile(data)

    // Must come from BASIC_PAGE (the real content page), not the background's "Block Diagram" title box.
    expect(result.shapes.map((s) => s.label)).toEqual(expect.arrayContaining(['Spine1\n8325-32C', 'Leaf1\n8325-48Y8C']))
    expect(result.shapes.some((s) => s.label === 'Block Diagram')).toBe(false)
    expect(result.connectors).toHaveLength(1)
  })

  it('does not flag truncation when only one page is a real (non-background) page', async () => {
    const backgroundPage = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main" xml:space="preserve">
  <Shapes><Shape ID="1" Type="Shape"><Cell N="PinX" V="1"/><Cell N="PinY" V="1"/><Text>Title</Text></Shape></Shapes>
</PageContents>`
    const data = await buildVsdxWithBackgroundPage(backgroundPage, BASIC_PAGE)
    const result = await parseVsdxFile(data)
    expect(result.truncatedToFirstPage).toBe(false)
  })

  it('keeps a shape that is glued to another shape (both Begin and End pointing at the same target) as a switch candidate, not a phantom connector', async () => {
    // Real Visio files generate this for devices glued to a neighbor for rack-stack
    // alignment — Begin and End both resolve to the SAME other shape, which is not
    // a real two-endpoint link and must not make the glued device vanish.
    const page = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main" xml:space="preserve">
  <PageSheet><Cell N="PageWidth" V="11"/><Cell N="PageHeight" V="8.5"/></PageSheet>
  <Shapes>
    <Shape ID="30" NameU="JL679A" Type="Group" Master="3">
      <Cell N="PinX" V="4"/><Cell N="PinY" V="5"/>
      <Text>Core switch</Text>
    </Shape>
    <Shape ID="32" NameU="J9283D" Type="Group" Master="4">
      <Cell N="PinX" V="4.5"/><Cell N="PinY" V="5"/>
      <Cell N="BeginX" V="4.2"/><Cell N="EndX" V="4.4"/>
      <Text>Stacked switch</Text>
    </Shape>
  </Shapes>
  <Connects>
    <Connect FromSheet="32" FromCell="BeginX" ToSheet="30" ToCell="Connections.X2"/>
    <Connect FromSheet="32" FromCell="EndX" ToSheet="30" ToCell="Connections.X3"/>
  </Connects>
</PageContents>`
    const data = await buildTestVsdx([page])
    const result = await parseVsdxFile(data)

    expect(result.shapes.map((s) => s.id)).toEqual(expect.arrayContaining(['30', '32']))
    expect(result.connectors).toHaveLength(0)
  })

  it('appends a stencil master SKU (NameU) to the label when present and not already in the text', async () => {
    const page = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main" xml:space="preserve">
  <PageSheet><Cell N="PageWidth" V="11"/><Cell N="PageHeight" V="8.5"/></PageSheet>
  <Shapes>
    <Shape ID="1" NameU="JL322A" Type="Group" Master="2">
      <Cell N="PinX" V="2"/><Cell N="PinY" V="7"/>
      <Text>HPE ANW 2930M 48G PoE+ 1-slot Switch #5</Text>
    </Shape>
    <Shape ID="2" NameU="JL679A" Type="Group" Master="3">
      <Cell N="PinX" V="4"/><Cell N="PinY" V="7"/>
      <Text></Text>
    </Shape>
  </Shapes>
</PageContents>`
    const data = await buildTestVsdx([page])
    const result = await parseVsdxFile(data)

    const withText = result.shapes.find((s) => s.id === '1')
    const withoutText = result.shapes.find((s) => s.id === '2')
    expect(withText?.label).toBe('HPE ANW 2930M 48G PoE+ 1-slot Switch #5 [JL322A]')
    expect(withoutText?.label).toBe('JL679A')
  })
})
