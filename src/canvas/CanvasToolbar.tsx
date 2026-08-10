import { Info, Magnet, Wand2 } from 'lucide-react'

const btnBase =
  'flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors'
const btnOff = 'border-slate-700 bg-slate-900/95 text-slate-300 hover:bg-slate-800'
const btnOn = 'border-sky-500 bg-sky-900/80 text-sky-100'

export function CanvasToolbar({
  onAutoLayout,
  snapEnabled,
  onToggleSnap,
  legendVisible,
  onToggleLegend,
}: {
  onAutoLayout: () => void
  snapEnabled: boolean
  onToggleSnap: () => void
  legendVisible: boolean
  onToggleLegend: () => void
}) {
  return (
    <div className="pointer-events-auto flex gap-1.5">
      <button className={`${btnBase} ${btnOff}`} onClick={onAutoLayout} title="Arrange switches into role-based rows">
        <Wand2 size={13} />
        Auto-arrange
      </button>
      <button
        className={`${btnBase} ${snapEnabled ? btnOn : btnOff}`}
        onClick={onToggleSnap}
        title="Snap switches to a grid while dragging"
      >
        <Magnet size={13} />
        Snap
      </button>
      <button
        className={`${btnBase} ${legendVisible ? btnOn : btnOff}`}
        onClick={onToggleLegend}
        title="Show link-kind and port-speed legend"
      >
        <Info size={13} />
        Legend
      </button>
    </div>
  )
}
