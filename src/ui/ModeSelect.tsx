import { useRef, useState } from 'react'
import { useProjectStore } from '../store/useProjectStore'
import { importProjectFile } from '../persistence/importProject'
import type { FabricMode } from '../domain/types'

export function ModeSelect() {
  const startProject = useProjectStore((s) => s.startProject)
  const loadProject = useProjectStore((s) => s.loadProject)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const choose = (mode: FabricMode) => startProject(mode)

  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-950">
      <div className="max-w-2xl text-center">
        <h1 className="mb-2 text-2xl font-semibold text-slate-100">VXLAN Configurator</h1>
        <p className="mb-8 text-sm text-slate-400">
          Design an Aruba CX data-center fabric and generate CLI configuration. Start by choosing a fabric type.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            onClick={() => choose('evpn')}
            className="rounded-lg border-2 border-sky-700 bg-sky-950/60 p-6 text-left transition hover:border-sky-500 hover:bg-sky-950"
          >
            <div className="text-lg font-semibold text-sky-100">VXLAN EVPN</div>
            <p className="mt-2 text-sm text-sky-200/70">
              BGP EVPN control plane. Spine-leaf fabric with VSX-paired leaves, eBGP or OSPF underlay, symmetric IRB
              overlay. Recommended for most modern DC fabrics.
            </p>
          </button>
          <button
            onClick={() => choose('static-vxlan')}
            className="rounded-lg border-2 border-emerald-700 bg-emerald-950/60 p-6 text-left transition hover:border-emerald-500 hover:bg-emerald-950"
          >
            <div className="text-lg font-semibold text-emerald-100">Static VXLAN</div>
            <p className="mt-2 text-sm text-emerald-200/70">
              No control-plane protocol — statically configured VTEPs and flood lists. Simpler, typically used for
              small fixed topologies such as a single VSX pair.
            </p>
          </button>
        </div>

        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-sm text-slate-400 underline decoration-slate-600 underline-offset-4 hover:text-slate-200"
          >
            or load an existing project file…
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
