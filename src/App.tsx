import { useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { Network, PanelRightClose, PanelRightOpen, SlidersHorizontal, Terminal, Waypoints, Layers, Settings2 } from 'lucide-react'
import { useProjectStore } from './store/useProjectStore'
import { useIpPlan } from './store/selectors'
import { ModeSelect } from './ui/ModeSelect'
import { TopologyCanvas } from './canvas/TopologyCanvas'
import { Inspector } from './ui/Inspector'
import { SettingsPanel } from './ui/SettingsPanel'
import { IpPlanPanel } from './ui/IpPlanPanel'
import { ValidationBanner } from './ui/ValidationBanner'
import { VlanVrfPanel } from './ui/VlanVrfPanel'
import { CliPreviewPanel } from './ui/CliPreviewPanel'
import { ProjectMenu } from './ui/ProjectMenu'
import { useUndoRedoShortcuts } from './ui/useUndoRedoShortcuts'

const TABS = [
  { value: 'inspector', label: 'Inspector', icon: SlidersHorizontal },
  { value: 'ipplan', label: 'IP Plan', icon: Waypoints },
  { value: 'vlans', label: 'VLANs/VRFs', icon: Layers },
  { value: 'cli', label: 'CLI', icon: Terminal },
  { value: 'settings', label: 'Settings', icon: Settings2 },
] as const

const tabTrigger =
  'flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 border-b-2 border-transparent transition-colors data-[state=active]:border-sky-500 data-[state=active]:text-slate-100 hover:text-slate-200'

function Workspace() {
  const project = useProjectStore((s) => s.project)
  const renameProject = useProjectStore((s) => s.renameProject)
  const ipPlan = useIpPlan()
  const [asideOpen, setAsideOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('inspector')
  useUndoRedoShortcuts()

  if (!project) return null

  return (
    <div className="flex h-full w-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-3 py-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-600">
            <Network size={16} className="text-sky-500" />
          </div>
          <input
            className="rounded border border-transparent bg-transparent px-1 text-sm font-semibold text-slate-100 outline-none transition-colors hover:border-slate-700 focus:border-slate-600"
            value={project.projectName}
            onChange={(e) => renameProject(e.target.value)}
          />
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {project.settings.fabricMode === 'evpn' ? 'VXLAN EVPN' : 'Static VXLAN'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ProjectMenu ipPlan={ipPlan} />
          <button
            className="rounded-md border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            onClick={() => setAsideOpen((v) => !v)}
            title={asideOpen ? 'Collapse panel' : 'Expand panel'}
          >
            {asideOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
          </button>
        </div>
      </header>
      <ValidationBanner ipPlan={ipPlan} />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <TopologyCanvas />
        </div>

        {asideOpen ? (
          <aside className="flex w-[26rem] shrink-0 flex-col border-l border-slate-800 bg-slate-950/60">
            <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
              <Tabs.List className="flex flex-wrap border-b border-slate-800">
                {TABS.map(({ value, label, icon: Icon }) => (
                  <Tabs.Trigger key={value} value={value} className={tabTrigger}>
                    <Icon size={13} />
                    {label}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
              <Tabs.Content value="inspector" className="min-h-0 flex-1 overflow-y-auto">
                <Inspector ipPlan={ipPlan} />
              </Tabs.Content>
              <Tabs.Content value="ipplan" className="min-h-0 flex-1 overflow-y-auto">
                <IpPlanPanel ipPlan={ipPlan} />
              </Tabs.Content>
              <Tabs.Content value="vlans" className="min-h-0 flex-1 overflow-y-auto">
                <VlanVrfPanel ipPlan={ipPlan} />
              </Tabs.Content>
              <Tabs.Content value="cli" className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <CliPreviewPanel ipPlan={ipPlan} />
              </Tabs.Content>
              <Tabs.Content value="settings" className="min-h-0 flex-1 overflow-y-auto">
                <SettingsPanel />
              </Tabs.Content>
            </Tabs.Root>
          </aside>
        ) : (
          <aside className="flex w-11 shrink-0 flex-col items-center gap-1 border-l border-slate-800 bg-slate-950/60 py-2">
            {TABS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                title={label}
                onClick={() => {
                  setActiveTab(value)
                  setAsideOpen(true)
                }}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
              >
                <Icon size={15} />
              </button>
            ))}
          </aside>
        )}
      </div>
    </div>
  )
}

function App() {
  const project = useProjectStore((s) => s.project)
  return <div className="h-screen w-screen bg-slate-950">{project ? <Workspace /> : <ModeSelect />}</div>
}

export default App
