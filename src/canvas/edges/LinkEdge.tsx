import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps, type Edge } from '@xyflow/react'
import type { LinkKind } from '../../domain/types'
import { LINK_KIND_COLOR, LINK_KIND_LABEL } from '../../ui/theme'

export type LinkEdgeData = {
  kind: LinkKind
  label?: string
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
            pointerEvents: 'none',
            opacity: selected ? 1 : 0.85,
          }}
          className="whitespace-nowrap rounded-full border border-slate-700 bg-slate-950/90 px-2 py-0.5 text-[9px] font-medium tracking-wide text-slate-200 shadow"
        >
          {data?.label ?? LINK_KIND_LABEL[kind]}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
