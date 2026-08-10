import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { getCatalogEntry } from '../../domain/catalog'
import type { SwitchRole } from '../../domain/types'

export type SwitchNodeData = {
  catalogId: string
  role: SwitchRole
  name: string
  vsxGroupId?: string
}

export type SwitchNodeType = Node<SwitchNodeData, 'switchNode'>

const ROLE_COLOR: Record<SwitchRole, string> = {
  spine: 'bg-sky-900 border-sky-500 text-sky-100',
  leaf: 'bg-emerald-900 border-emerald-500 text-emerald-100',
  border: 'bg-amber-900 border-amber-500 text-amber-100',
  standalone: 'bg-slate-800 border-slate-500 text-slate-100',
}

const HANDLE_STYLE = { width: 10, height: 10, background: '#94a3b8' }

export function SwitchNode({ data, selected }: NodeProps<SwitchNodeType>) {
  const entry = getCatalogEntry(data.catalogId)
  const colorClass = ROLE_COLOR[data.role]

  return (
    <div
      className={`rounded-lg border-2 px-4 py-3 shadow-lg min-w-[160px] ${colorClass} ${
        selected ? 'ring-2 ring-white' : ''
      }`}
    >
      <Handle id="top" type="source" position={Position.Top} style={HANDLE_STYLE} />
      <Handle id="right" type="source" position={Position.Right} style={HANDLE_STYLE} />
      <Handle id="bottom" type="source" position={Position.Bottom} style={HANDLE_STYLE} />
      <Handle id="left" type="source" position={Position.Left} style={HANDLE_STYLE} />

      <div className="text-xs uppercase tracking-wide opacity-70">{data.role}</div>
      <div className="font-semibold">{data.name}</div>
      <div className="text-xs opacity-80">{entry?.model ?? data.catalogId}</div>
      {data.vsxGroupId && <div className="mt-1 text-[10px] font-medium text-white/80">VSX paired</div>}
    </div>
  )
}
