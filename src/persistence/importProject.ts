import { projectSchema } from '../domain/projectSchema'
import type { Project } from '../domain/types'

export interface ImportResult {
  ok: boolean
  project?: Project
  error?: string
}

export async function importProjectFile(file: File): Promise<ImportResult> {
  let raw: unknown
  try {
    const text = await file.text()
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Not valid JSON.' }
  }

  const result = projectSchema.safeParse(raw)
  if (!result.success) {
    const firstIssue = result.error.issues[0]
    const path = firstIssue?.path.join('.') || '(root)'
    return { ok: false, error: `Invalid project file at "${path}": ${firstIssue?.message ?? 'schema mismatch'}` }
  }

  return { ok: true, project: result.data as Project }
}
