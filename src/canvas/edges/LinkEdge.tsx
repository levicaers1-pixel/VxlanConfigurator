import { BaseEdge, EdgeLabelRenderer, getStraightPath, type EdgeProps, type Edge } from '@xyflow/react'
import type { LinkKind } from '../../domain/types'

export type LinkEdgeData = {
  kind: LinkKind
  label?: string
}

export type LinkEdgeType = Edge<LinkEdgeData, 'linkEdge'>

const KIND_COLOR: Record<LinkKind, string> = {
  'underlay-p2p': '#38bdf8',
  'vsx-isl': '#f472b6',
  'vsx-keepalive': '#fbbf24',
  mgmt: '#94a3b8',
  unassigned: '#475569',
}

const KIND_LABEL: Record<LinkKind, string> = {
  'underlay-p2p': 'underlay',
  'vsx-isl': 'VSX ISL',
  'vsx-keepalive': 'VSX keepalive',
  mgmt: 'mgmt',
  unassigned: 'link',
}

export function LinkEdge({ id, sourceX, sourceY, targetX, targetY, data, selected }: EdgeProps<LinkEdgeType>) {
  const kind = data?.kind ?? 'unassigned'
  const [edgePath, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY })
  const color = KIND_COLOR[kind]

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke: color, strokeWidth: selected ? 3 : 2 }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'none',
          }}
          className="rounded bg-slate-950/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-200 border border-slate-700"
        >
          {data?.label ?? KIND_LABEL[kind]}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
