import { useRef, useState } from 'react'
import { FilePlus2, FileInput, FolderUp, PackageOpen, Redo2, Save, Undo2 } from 'lucide-react'
import { useProjectStore } from '../store/useProjectStore'
import { exportProject } from '../persistence/exportProject'
import { importProjectFile } from '../persistence/importProject'
import { downloadConfigBundle } from '../cli/generateBundle'
import type { IpAllocationResult } from '../domain/types'
import { Button, IconButton } from './primitives'
import { ImportVisioDialog } from './ImportVisioDialog'

export function ProjectMenu({ ipPlan }: { ipPlan: IpAllocationResult | null }) {
  const project = useProjectStore((s) => s.project)
  const loadProject = useProjectStore((s) => s.loadProject)
  const closeProject = useProjectStore((s) => s.closeProject)
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)
  const canUndo = useProjectStore((s) => s.past.length > 0)
  const canRedo = useProjectStore((s) => s.future.length > 0)
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
      <div className="flex items-center gap-1 border-r border-slate-800 pr-2">
        <IconButton icon={<Undo2 size={14} />} disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)" />
        <IconButton icon={<Redo2 size={14} />} disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Shift+Z)" />
      </div>
      <Button icon={<Save size={13} />} onClick={() => exportProject(project)}>
        Save
      </Button>
      <Button icon={<FolderUp size={13} />} onClick={() => fileInputRef.current?.click()}>
        Load
      </Button>
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
      <ImportVisioDialog
        trigger={
          <Button icon={<FileInput size={13} />}>
            Import Visio
          </Button>
        }
      />
      <Button
        icon={<PackageOpen size={13} />}
        disabled={!ipPlan}
        onClick={() => ipPlan && downloadConfigBundle(project, ipPlan)}
      >
        Download all
      </Button>
      <Button
        icon={<FilePlus2 size={13} />}
        onClick={() => {
          if (window.confirm('Start a new fabric? Unsaved changes to the current one will be lost.')) {
            closeProject()
          }
        }}
      >
        New
      </Button>
    </div>
  )
}
