import { describe, expect, it } from 'vitest'
import { newProject } from '../store/useProjectStore'
import { importProjectFile } from './importProject'

function toFile(obj: unknown): File {
  return new File([JSON.stringify(obj)], 'project.json', { type: 'application/json' })
}

describe('importProjectFile', () => {
  it('round-trips a freshly created project unchanged', async () => {
    const project = newProject('evpn')
    project.switches.push({
      id: 's1',
      catalogId: 'aruba-8325-32c',
      name: 'SPINE1',
      role: 'spine',
      sequence: 1,
      position: { x: 10, y: 20 },
    })

    const result = await importProjectFile(toFile(project))
    expect(result.ok).toBe(true)
    expect(result.project).toEqual(project)
  })

  it('rejects malformed JSON', async () => {
    const file = new File(['not json'], 'bad.json', { type: 'application/json' })
    const result = await importProjectFile(file)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/not valid json/i)
  })

  it('rejects a schema mismatch with a descriptive error', async () => {
    const result = await importProjectFile(toFile({ hello: 'world' }))
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('rejects an unsupported formatVersion', async () => {
    const project = newProject('static-vxlan')
    const result = await importProjectFile(toFile({ ...project, formatVersion: 2 }))
    expect(result.ok).toBe(false)
  })
})
