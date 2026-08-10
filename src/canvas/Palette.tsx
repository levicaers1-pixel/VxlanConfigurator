import { SWITCH_CATALOG } from '../domain/catalog'
import type { SwitchRole } from '../domain/types'

const ROLE_OPTIONS: SwitchRole[] = ['spine', 'leaf', 'border', 'standalone']

export const DRAG_MIME = 'application/vxlan-switch'

export function Palette() {
  return (
    <div className="flex h-full w-64 flex-col overflow-y-auto border-r border-slate-800 bg-slate-950/60 p-3">
      <h2 className="mb-2 text-sm font-semibold text-slate-300">Switch catalog</h2>
      <p className="mb-3 text-xs text-slate-500">Drag a model onto the canvas to place it.</p>
      <div className="flex flex-col gap-2">
        {SWITCH_CATALOG.map((entry) => (
          <div
            key={entry.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ catalogId: entry.id, role: entry.suitableRoles[0] }))
              e.dataTransfer.effectAllowed = 'move'
            }}
            className="cursor-grab rounded-md border border-slate-700 bg-slate-900 p-2 text-xs hover:border-slate-500 active:cursor-grabbing"
          >
            <div className="font-semibold text-slate-200">{entry.model}</div>
            <div className="text-slate-400">{entry.series}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {entry.suitableRoles.map((r) => (
                <span key={r} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">
                  {r}
                </span>
              ))}
            </div>
            <div className="mt-1 text-[10px] text-slate-500">
              {entry.portGroups.map((g) => `${g.count}x${g.speedGbps}G`).join(' + ')}
              {entry.supportsVsx ? ' · VSX' : ''}
              {entry.supportsEvpn ? ' · EVPN' : ''}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-slate-600">
        Default role on drop is the model&apos;s primary suitable role: {ROLE_OPTIONS.join(', ')} — change it in the
        inspector after placing.
      </p>
    </div>
  )
}
