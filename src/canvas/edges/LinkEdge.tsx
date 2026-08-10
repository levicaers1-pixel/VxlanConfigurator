import { X } from 'lucide-react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps, type Edge } from '@xyflow/react'
import type { LinkKind } from '../../domain/types'
import { LINK_KIND_COLOR, LINK_KIND_LABEL } from '../../ui/theme'

export type LinkEdgeData = {
  kind: LinkKind
  label?: string
  onDelete?: () => void
}

export type LinkEdgeType = Edge<LinkEdgeData, 'linkEdge'>

export function LinkEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<LinkEdgeType>) {
  const kind = data?.kind ?? 'unassigned'
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.25,
  })
  const color = LINK_KIND_COLOR[kind]

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: kind === 'unassigned' ? '4 3' : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          className={`group flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] font-medium tracking-wide shadow transition-colors ${
            selected ? 'border-slate-500 bg-slate-900 text-slate-100' : 'border-slate-700 bg-slate-950/90 text-slate-200'
          }`}
        >
          {data?.label ?? LINK_KIND_LABEL[kind]}
          {data?.onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                data.onDelete?.()
              }}
              title="Delete link"
              className="rounded-full p-0.5 text-slate-500 opacity-0 transition-opacity hover:bg-rose-950 hover:text-rose-300 group-hover:opacity-100"
            >
              <X size={10} />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
