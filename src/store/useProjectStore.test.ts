import { beforeEach, describe, expect, it } from 'vitest'
import { useProjectStore } from './useProjectStore'
import type { SwitchCatalogEntry } from '../domain/types'

function customEntry(id: string): SwitchCatalogEntry {
  return {
    id,
    vendor: 'Custom',
    series: 'Custom',
    model: id,
    suitableRoles: ['access'],
    portGroups: [{ count: 24, speedGbps: 1, namePrefix: '1/1/', startIndex: 1 }],
    supportsVsx: false,
    supportsEvpn: false,
    custom: true,
  }
}

function reset() {
  useProjectStore.setState({ project: null, past: [], future: [] })
}

describe('useProjectStore — setVsxPair auto-tags the ISL link', () => {
  beforeEach(reset)

  it('retags an existing underlay-p2p link between the pair as vsx-isl', () => {
    useProjectStore.getState().startProject('evpn')
    const idA = useProjectStore.getState().addSwitch('aruba-8325-48y8c', 'leaf', { x: 0, y: 0 })
    const idB = useProjectStore.getState().addSwitch('aruba-8325-48y8c', 'leaf', { x: 0, y: 0 })
    const linkId = useProjectStore
      .getState()
      .addLink({ switchInstanceId: idA, portName: '1/1/51' }, { switchInstanceId: idB, portName: '1/1/51' }, 'underlay-p2p')

    useProjectStore.getState().setVsxPair(idA, idB)

    const project = useProjectStore.getState().project!
    expect(project.links.find((l) => l.id === linkId)?.kind).toBe('vsx-isl')
    expect(project.switches.find((s) => s.id === idA)?.vsxGroupId).toBe(
      project.switches.find((s) => s.id === idB)?.vsxGroupId,
    )
  })

  it('does not retouch a link between the pair that is already meaningfully typed (e.g. mgmt)', () => {
    useProjectStore.getState().startProject('evpn')
    const idA = useProjectStore.getState().addSwitch('aruba-8325-48y8c', 'leaf', { x: 0, y: 0 })
    const idB = useProjectStore.getState().addSwitch('aruba-8325-48y8c', 'leaf', { x: 0, y: 0 })
    const linkId = useProjectStore
      .getState()
      .addLink({ switchInstanceId: idA, portName: '1/1/51' }, { switchInstanceId: idB, portName: '1/1/51' }, 'mgmt')

    useProjectStore.getState().setVsxPair(idA, idB)

    const project = useProjectStore.getState().project!
    expect(project.links.find((l) => l.id === linkId)?.kind).toBe('mgmt')
  })

  it('leaves unrelated links (not between this pair) untouched', () => {
    useProjectStore.getState().startProject('evpn')
    const idA = useProjectStore.getState().addSwitch('aruba-8325-48y8c', 'leaf', { x: 0, y: 0 })
    const idB = useProjectStore.getState().addSwitch('aruba-8325-48y8c', 'leaf', { x: 0, y: 0 })
    const idC = useProjectStore.getState().addSwitch('aruba-8325-32c', 'spine', { x: 0, y: 0 })
    const linkId = useProjectStore
      .getState()
      .addLink({ switchInstanceId: idA, portName: '1/1/1' }, { switchInstanceId: idC, portName: '1/1/1' }, 'underlay-p2p')

    useProjectStore.getState().setVsxPair(idA, idB)

    const project = useProjectStore.getState().project!
    expect(project.links.find((l) => l.id === linkId)?.kind).toBe('underlay-p2p')
  })
})

describe('useProjectStore — addCustomCatalogEntries', () => {
  beforeEach(reset)

  it('adds new custom catalog entries to the project', () => {
    useProjectStore.getState().startProject('evpn')
    useProjectStore.getState().addCustomCatalogEntries([customEntry('custom-foo'), customEntry('custom-bar')])

    const project = useProjectStore.getState().project!
    expect(project.customCatalogEntries.map((e) => e.id)).toEqual(['custom-foo', 'custom-bar'])
  })

  it('skips entries whose id is already present, so importing the same file twice does not duplicate them', () => {
    useProjectStore.getState().startProject('evpn')
    useProjectStore.getState().addCustomCatalogEntries([customEntry('custom-foo')])
    useProjectStore.getState().addCustomCatalogEntries([customEntry('custom-foo'), customEntry('custom-bar')])

    const project = useProjectStore.getState().project!
    expect(project.customCatalogEntries.map((e) => e.id)).toEqual(['custom-foo', 'custom-bar'])
  })
})
