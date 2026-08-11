import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { getCatalogEntry } from '../../domain/catalog'
import { useProjectStore } from '../../store/useProjectStore'
import type { LinkKind, SwitchRole } from '../../domain/types'
import { LINK_KIND_COLOR, ROLE_COLOR, SPEED_COLOR } from '../../ui/theme'

export type SwitchNodeData = {
  catalogId: string
  role: SwitchRole
  name: string
  vsxGroupId?: string
  /** portName -> kind of the link currently occupying it, for faceplate coloring */
  portStatus: Record<string, LinkKind>
}

export type SwitchNodeType = Node<SwitchNodeData, 'switchNode'>

const PORT_STATIC_STYLE = { position: 'static' as const, transform: 'none' }

export function SwitchNode({ data, selected }: NodeProps<SwitchNodeType>) {
  const customCatalogEntries = useProjectStore((s) => s.project?.customCatalogEntries ?? [])
  const entry = getCatalogEntry(data.catalogId, customCatalogEntries)
  const colors = ROLE_COLOR[data.role]

  return (
    <div
      className={`rounded-xl border shadow-lg backdrop-blur-sm transition-shadow ${colors.bg} ${colors.border} ${colors.text} ${
        selected ? 'ring-2 ring-white/80 shadow-white/10' : 'shadow-black/40'
      }`}
      style={{ minWidth: 168 }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
        <div className="min-w-0">
          <div className="text-[9px] font-semibold uppercase tracking-widest opacity-60">{data.role}</div>
          <div className="truncate text-sm font-semibold leading-tight">{data.name}</div>
        </div>
        {data.vsxGroupId && (
          <span className="shrink-0 rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide">
            VSX
          </span>
        )}
      </div>

      <div className="px-3 py-1 text-[10px] opacity-70">
        {entry?.model ?? data.catalogId}
        {entry?.custom && (
          <span className="ml-1 rounded-full bg-amber-500/20 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-amber-300">
            unverified
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 px-3 pb-3 pt-1">
        {entry?.portGroups.map((group, gi) => {
          const ports = Array.from({ length: group.count }, (_, i) => `${group.namePrefix}${group.startIndex + i}`)
          const speedColor = SPEED_COLOR[group.speedGbps]
          return (
            <div key={gi}>
              <div className="mb-0.5 text-[8px] uppercase tracking-wide opacity-50">
                {group.count}× {group.speedGbps}G
              </div>
              <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
                {ports.map((portName) => {
                  const kind = data.portStatus[portName]
                  const used = !!kind
                  return (
                    <Handle
                      key={portName}
                      id={portName}
                      type="source"
                      position={Position.Bottom}
                      title={`${portName} · ${group.speedGbps}G${used ? ` · ${kind}` : ' · free'}`}
                      style={{
                        ...PORT_STATIC_STYLE,
                        width: 9,
                        height: 9,
                        borderRadius: 2,
                        border: `1px solid ${used ? LINK_KIND_COLOR[kind] : speedColor}`,
                        background: used ? LINK_KIND_COLOR[kind] : 'transparent',
                      }}
                      className="!static hover:!scale-125 hover:!brightness-125"
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
