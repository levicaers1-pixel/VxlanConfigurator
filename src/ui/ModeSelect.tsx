import { useRef, useState } from 'react'
import { Check, FolderUp, GitBranch, MousePointerClick, Network, Terminal, Waypoints } from 'lucide-react'
import { useProjectStore } from '../store/useProjectStore'
import { importProjectFile } from '../persistence/importProject'
import type { FabricMode } from '../domain/types'

const EVPN_FEATURES = [
  'Spine-leaf fabric with VSX-paired leaves',
  'eBGP or OSPF underlay, your choice',
  'Symmetric IRB overlay with auto RD/RT',
]

const STATIC_FEATURES = [
  'No control-plane protocol required',
  'Structurally-derived remote-VTEP flood lists',
  'Best for a single VSX pair or small mesh',
]

const STEPS = [
  { icon: MousePointerClick, title: 'Design', body: 'Drag switches onto the canvas, wire up real ports.' },
  { icon: Network, title: 'Allocate', body: 'IPs, VNIs, and ASNs derive live as you build.' },
  { icon: Terminal, title: 'Generate', body: 'Get per-switch Aruba AOS-CX CLI, ready to review.' },
]

export function ModeSelect() {
  const startProject = useProjectStore((s) => s.startProject)
  const loadProject = useProjectStore((s) => s.loadProject)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const choose = (mode: FabricMode) => startProject(mode)

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-y-auto bg-slate-950 px-6 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(56,189,248,0.12), transparent 40%), radial-gradient(circle at 80% 70%, rgba(52,211,153,0.10), transparent 40%), radial-gradient(circle at 50% 100%, rgba(129,140,248,0.08), transparent 45%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 w-full max-w-3xl text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 text-[11px] font-medium text-slate-400">
          <Network size={13} className="text-sky-400" />
          Aruba CX data-center fabric designer
        </div>
        <h1 className="mb-3 text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">VXLAN Configurator</h1>
        <p className="mx-auto mb-10 max-w-md text-sm text-slate-400">
          Design your fabric visually, watch the IP plan build itself, and walk away with real per-switch CLI. Start
          by choosing a control-plane model.
        </p>

        <div className="grid grid-cols-1 gap-4 text-left sm:grid-cols-2">
          <button
            onClick={() => choose('evpn')}
            className="group relative overflow-hidden rounded-xl border border-sky-800/60 bg-gradient-to-b from-sky-950/70 to-slate-950/70 p-6 text-left shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:border-sky-500 hover:shadow-sky-950/40"
          >
            <Waypoints className="mb-3 text-sky-400" size={22} />
            <div className="text-base font-semibold text-sky-100">VXLAN EVPN</div>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-sky-500/80">Recommended</p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {EVPN_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-1.5 text-xs text-sky-200/80">
                  <Check size={13} className="mt-0.5 shrink-0 text-sky-500" />
                  {f}
                </li>
              ))}
            </ul>
          </button>

          <button
            onClick={() => choose('static-vxlan')}
            className="group relative overflow-hidden rounded-xl border border-emerald-800/60 bg-gradient-to-b from-emerald-950/70 to-slate-950/70 p-6 text-left shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:border-emerald-500 hover:shadow-emerald-950/40"
          >
            <GitBranch className="mb-3 text-emerald-400" size={22} />
            <div className="text-base font-semibold text-emerald-100">Static VXLAN</div>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-emerald-500/80">Simple &amp; small</p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {STATIC_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-1.5 text-xs text-emerald-200/80">
                  <Check size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                  {f}
                </li>
              ))}
            </ul>
          </button>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 border-t border-slate-800/80 pt-8 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="flex items-start gap-2.5 text-left">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[11px] font-semibold text-slate-400">
                {i + 1}
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                  <Icon size={13} className="text-slate-500" />
                  {title}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-300"
          >
            <FolderUp size={13} />
            Load an existing project file
          </button>
          {error && <span className="text-xs text-rose-400">{error}</span>}
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
        </div>
      </div>
    </div>
  )
}
