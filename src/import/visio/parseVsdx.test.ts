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
})
