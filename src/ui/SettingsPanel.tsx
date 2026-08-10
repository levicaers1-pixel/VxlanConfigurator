import { useProjectStore } from '../store/useProjectStore'
import type { AsnScheme, UnderlayProtocol, VniStrategy } from '../domain/types'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-slate-400">{label}</span>
      {children}
    </label>
  )
}

const inputClass = 'rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100'

export function SettingsPanel() {
  const project = useProjectStore((s) => s.project)
  const updateSettings = useProjectStore((s) => s.updateSettings)

  if (!project) return null
  const { settings } = project

  return (
    <div className="flex flex-col gap-4 p-3 text-sm">
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fabric</h3>
        <div className="text-xs text-slate-400">
          Mode: <span className="text-slate-200">{settings.fabricMode}</span>
        </div>
        <Field label="Underlay protocol">
          <select
            className={inputClass}
            value={settings.underlayProtocol}
            onChange={(e) => updateSettings({ underlayProtocol: e.target.value as UnderlayProtocol })}
          >
            <option value="ebgp">eBGP</option>
            <option value="ospf">OSPF</option>
          </select>
        </Field>
        {settings.underlayProtocol === 'ospf' && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="OSPF process ID">
              <input
                type="number"
                className={inputClass}
                value={settings.ospfProcessId ?? 1}
                onChange={(e) => updateSettings({ ospfProcessId: Number(e.target.value) })}
              />
            </Field>
            <Field label="OSPF area">
              <input
                className={inputClass}
                value={settings.ospfArea ?? '0.0.0.0'}
                onChange={(e) => updateSettings({ ospfArea: e.target.value })}
              />
            </Field>
          </div>
        )}
        {(settings.fabricMode === 'evpn' || settings.underlayProtocol === 'ebgp') && (
          <>
            <Field label="ASN scheme">
              <select
                className={inputClass}
                value={settings.asnScheme}
                onChange={(e) => updateSettings({ asnScheme: e.target.value as AsnScheme })}
              >
                <option value="per-device-unique">Per-device unique</option>
                <option value="shared-leaf-asn">Shared ASN per VSX pair</option>
              </select>
            </Field>
            <Field label="Base ASN">
              <input
                type="number"
                className={inputClass}
                value={settings.baseAsn}
                onChange={(e) => updateSettings({ baseAsn: Number(e.target.value) })}
              />
            </Field>
          </>
        )}
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={settings.jumboMtu}
            onChange={(e) => updateSettings({ jumboMtu: e.target.checked })}
          />
          Jumbo MTU (9198) on VXLAN-facing interfaces
        </label>
      </section>

      <section className="flex flex-col gap-2 border-t border-slate-800 pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">IP pools</h3>
        <Field label="Underlay point-to-point (/31 each)">
          <input
            className={inputClass}
            value={settings.pools.underlayP2P.supernet}
            onChange={(e) =>
              updateSettings({ pools: { ...settings.pools, underlayP2P: { supernet: e.target.value } } })
            }
          />
        </Field>
        <Field label="Loopback (/32 each)">
          <input
            className={inputClass}
            value={settings.pools.loopback.supernet}
            onChange={(e) => updateSettings({ pools: { ...settings.pools, loopback: { supernet: e.target.value } } })}
          />
        </Field>
        <Field label="VSX keepalive (/31 per pair)">
          <input
            className={inputClass}
            value={settings.pools.vsxKeepalive.supernet}
            onChange={(e) =>
              updateSettings({ pools: { ...settings.pools, vsxKeepalive: { supernet: e.target.value } } })
            }
          />
        </Field>
        <Field label="Tenant subnets">
          <input
            className={inputClass}
            value={settings.pools.tenantSubnets.supernet}
            onChange={(e) =>
              updateSettings({ pools: { ...settings.pools, tenantSubnets: { supernet: e.target.value } } })
            }
          />
        </Field>
        <Field label="Tenant subnet prefix length">
          <input
            type="number"
            min={1}
            max={30}
            className={inputClass}
            value={settings.tenantSubnetPrefixLen}
            onChange={(e) => updateSettings({ tenantSubnetPrefixLen: Number(e.target.value) })}
          />
        </Field>
      </section>

      <section className="flex flex-col gap-2 border-t border-slate-800 pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">VNI allocation</h3>
        <Field label="L2VNI strategy">
          <select
            className={inputClass}
            value={settings.vniAllocation.l2VniStrategy}
            onChange={(e) =>
              updateSettings({
                vniAllocation: { ...settings.vniAllocation, l2VniStrategy: e.target.value as VniStrategy },
              })
            }
          >
            <option value="vlan-plus-offset">VLAN + offset</option>
            <option value="explicit-pool">Explicit sequential pool</option>
          </select>
        </Field>
        <Field label={settings.vniAllocation.l2VniStrategy === 'explicit-pool' ? 'Pool start' : 'Offset'}>
          <input
            type="number"
            className={inputClass}
            value={settings.vniAllocation.l2VniOffset}
            onChange={(e) =>
              updateSettings({
                vniAllocation: { ...settings.vniAllocation, l2VniOffset: Number(e.target.value) },
              })
            }
          />
        </Field>
        <Field label="L3VNI pool start (per VRF)">
          <input
            type="number"
            className={inputClass}
            value={settings.vniAllocation.l3VniPoolStart}
            onChange={(e) =>
              updateSettings({
                vniAllocation: { ...settings.vniAllocation, l3VniPoolStart: Number(e.target.value) },
              })
            }
          />
        </Field>
      </section>
    </div>
  )
}
