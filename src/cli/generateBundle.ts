import JSZip from 'jszip'
import type { IpAllocationResult, Project } from '../domain/types'
import { generateSwitchConfig } from './generateSwitchConfig'

export async function generateConfigBundle(project: Project, ipPlan: IpAllocationResult): Promise<Blob> {
  const zip = new JSZip()
  for (const sw of project.switches) {
    const config = generateSwitchConfig(sw.id, project, ipPlan)
    zip.file(`${sw.name}.txt`, config)
  }
  return zip.generateAsync({ type: 'blob' })
}

export async function downloadConfigBundle(project: Project, ipPlan: IpAllocationResult): Promise<void> {
  const blob = await generateConfigBundle(project, ipPlan)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${project.projectName.trim() || 'fabric'}-configs.zip`
  a.click()
  URL.revokeObjectURL(url)
}
