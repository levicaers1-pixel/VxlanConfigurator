import { useRef, useState } from 'react'
import { useProjectStore } from '../store/useProjectStore'
import { exportProject } from '../persistence/exportProject'
import { importProjectFile } from '../persistence/importProject'
import { downloadConfigBundle } from '../cli/generateBundle'
import type { IpAllocationResult } from '../domain/types'

const buttonClass = 'rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800'

export function ProjectMenu({ ipPlan }: { ipPlan: IpAllocationResult | null }) {
  const project = useProjectStore((s) => s.project)
  const loadProject = useProjectStore((s) => s.loadProject)
  const closeProject = useProjectStore((s) => s.closeProject)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  if (!project) return null

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="max-w-xs truncate text-xs text-rose-400" title={error}>
          {error}
        </span>
      )}
      <button className={buttonClass} onClick={() => exportProject(project)}>
        Save
      </button>
      <button className={buttonClass} onClick={() => fileInputRef.current?.click()}>
        Load
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          const result = await importProjectFile(file)
          if (!result.ok || !result.project) {
            setError(result.error ?? 'Failed to load project.')
            return
          }
          setError(null)
          loadProject(result.project)
        }}
      />
      <button
        className={buttonClass}
        disabled={!ipPlan}
        onClick={() => ipPlan && downloadConfigBundle(project, ipPlan)}
      >
        Download all configs
      </button>
      <button
        className={buttonClass}
        onClick={() => {
          if (window.confirm('Start a new fabric? Unsaved changes to the current one will be lost.')) {
            closeProject()
          }
        }}
      >
        New
      </button>
    </div>
  )
}
