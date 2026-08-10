import { useState } from 'react'
import { useProjectStore } from '../store/useProjectStore'
import type { IpAllocationResult } from '../domain/types'

const inputClass = 'rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100'

export function VlanVrfPanel({ ipPlan }: { ipPlan: IpAllocationResult | null }) {
  const project = useProjectStore((s) => s.project)
  const addVrf = useProjectStore((s) => s.addVrf)
  const removeVrf = useProjectStore((s) => s.removeVrf)
  const addVlan = useProjectStore((s) => s.addVlan)
  const removeVlan = useProjectStore((s) => s.removeVlan)

  const [vrfName, setVrfName] = useState('')
  const [vlanId, setVlanId] = useState('')
  const [vlanName, setVlanName] = useState('')
  const [vlanVrf, setVlanVrf] = useState('')

  if (!project) return null

  return (
    <div className="flex flex-col gap-4 p-3 text-sm">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">VRFs</h3>
        <div className="mb-2 flex gap-2">
          <input
            className={`${inputClass} flex-1`}
            placeholder="VRF name (e.g. CUSTOMER-A)"
            value={vrfName}
            onChange={(e) => setVrfName(e.target.value)}
          />
          <button
            className="rounded border border-sky-800 bg-sky-950/50 px-2 text-xs text-sky-200 hover:bg-sky-950"
            onClick={() => {
              if (!vrfName.trim()) return
              addVrf({ name: vrfName.trim() })
              setVrfName('')
            }}
          >
            Add
          </button>
        </div>
        <ul className="flex flex-col gap-1">
          {project.vrfs.map((vrf) => (
            <li key={vrf.id} className="flex items-center justify-between rounded bg-slate-900/60 px-2 py-1 text-xs">
              <span>
                {vrf.name}
                {ipPlan?.l3Vnis[vrf.id] !== undefined && (
                  <span className="ml-2 text-slate-500">L3VNI {ipPlan.l3Vnis[vrf.id]}</span>
                )}
              </span>
              <button className="text-rose-400 hover:text-rose-300" onClick={() => removeVrf(vrf.id)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-slate-800 pt-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">VLANs</h3>
        <div className="mb-2 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="number"
              className={`${inputClass} w-20`}
              placeholder="ID"
              value={vlanId}
              onChange={(e) => setVlanId(e.target.value)}
            />
            <input
              className={`${inputClass} flex-1`}
              placeholder="Name"
              value={vlanName}
              onChange={(e) => setVlanName(e.target.value)}
            />
          </div>
          <select className={inputClass} value={vlanVrf} onChange={(e) => setVlanVrf(e.target.value)}>
            <option value="">No VRF (L2 only)</option>
            {project.vrfs.map((vrf) => (
              <option key={vrf.id} value={vrf.id}>
                {vrf.name}
              </option>
            ))}
          </select>
          <button
            className="rounded border border-sky-800 bg-sky-950/50 px-2 py-1 text-xs text-sky-200 hover:bg-sky-950"
            onClick={() => {
              const id = Number(vlanId)
              if (!id || !vlanName.trim()) return
              addVlan({ vlanId: id, name: vlanName.trim(), vrfId: vlanVrf || undefined })
              setVlanId('')
              setVlanName('')
              setVlanVrf('')
            }}
          >
            Add VLAN
          </button>
        </div>
        <ul className="flex flex-col gap-1">
          {project.vlans.map((vlan) => (
            <li key={vlan.id} className="flex items-center justify-between rounded bg-slate-900/60 px-2 py-1 text-xs">
              <span>
                VLAN {vlan.vlanId} — {vlan.name}
                {ipPlan?.l2Vnis[vlan.id] !== undefined && (
                  <span className="ml-2 text-slate-500">VNI {ipPlan.l2Vnis[vlan.id]}</span>
                )}
                {ipPlan?.tenantSubnets[vlan.id] && (
                  <span className="ml-2 text-slate-500">{ipPlan.tenantSubnets[vlan.id]}</span>
                )}
              </span>
              <button className="text-rose-400 hover:text-rose-300" onClick={() => removeVlan(vlan.id)}>
                ×
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[10px] text-slate-600">
          VLANs apply to all leaves by default. Per-switch scoping isn&apos;t exposed in this UI yet.
        </p>
      </section>
    </div>
  )
}
