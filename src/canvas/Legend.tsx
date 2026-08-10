import { LINK_KIND_COLOR, LINK_KIND_LABEL, SPEED_COLOR } from '../ui/theme'
import type { LinkKind, PortSpeedGbps } from '../domain/types'

const LINK_KINDS: LinkKind[] = ['underlay-p2p', 'vsx-isl', 'vsx-keepalive', 'mgmt', 'unassigned']
const SPEEDS: PortSpeedGbps[] = [1, 10, 25, 40, 100, 400]

export function Legend() {
  return (
    <div className="pointer-events-auto flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-950/95 p-3 text-[10px] shadow-xl backdrop-blur">
      <div>
        <div className="mb-1 font-semibold uppercase tracking-wide text-slate-400">Link kind</div>
        <div className="flex flex-col gap-1">
          {LINK_KINDS.map((k) => (
            <div key={k} className="flex items-center gap-1.5 text-slate-300">
              <span className="h-0.5 w-4 rounded" style={{ backgroundColor: LINK_KIND_COLOR[k] }} />
              {LINK_KIND_LABEL[k]}
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-slate-800 pt-2">
        <div className="mb-1 font-semibold uppercase tracking-wide text-slate-400">Port speed</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {SPEEDS.map((s) => (
            <div key={s} className="flex items-center gap-1 text-slate-300">
              <span className="h-2 w-2 rounded-[2px] border" style={{ borderColor: SPEED_COLOR[s] }} />
              {s}G
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
