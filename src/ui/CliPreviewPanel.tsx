import { useMemo, useState } from 'react'
import { Check, Copy, Download, Terminal } from 'lucide-react'
import { useProjectStore } from '../store/useProjectStore'
import { generateSwitchConfig } from '../cli/generateSwitchConfig'
import type { IpAllocationResult } from '../domain/types'
import { EmptyState } from './primitives'

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function CliPreviewPanel({ ipPlan }: { ipPlan: IpAllocationResult | null }) {
  const project = useProjectStore((s) => s.project)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const activeId = selectedId ?? project?.switches[0]?.id ?? null
  const config = useMemo(() => {
    if (!project || !ipPlan || !activeId) return ''
    try {
      return generateSwitchConfig(activeId, project, ipPlan)
    } catch (e) {
      return `! Error generating config: ${(e as Error).message}`
    }
  }, [project, ipPlan, activeId])

  if (!project || project.switches.length === 0) {
    return (
      <EmptyState
        icon={<Terminal size={22} />}
        title="No CLI to show yet"
        hint="Add switches to the topology and their per-device Aruba AOS-CX config will appear here."
      />
    )
  }
  if (!ipPlan) return null

  const activeSwitch = project.switches.find((s) => s.id === activeId)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap gap-1 border-b border-slate-800 p-2">
        {project.switches.map((sw) => (
          <button
            key={sw.id}
            onClick={() => setSelectedId(sw.id)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              sw.id === activeId ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            {sw.name}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-mono text-[11px] text-slate-500">{activeSwitch?.name}.txt</span>
        <div className="flex gap-2">
          <button
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
            onClick={async () => {
              await navigator.clipboard.writeText(config)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
            onClick={() => activeSwitch && downloadText(`${activeSwitch.name}.txt`, config)}
          >
            <Download size={12} />
            Download
          </button>
        </div>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto whitespace-pre bg-slate-950 px-3 pb-3 font-mono text-[11px] leading-5 text-slate-300">
        {config}
      </pre>
    </div>
  )
}
