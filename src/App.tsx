import * as Tabs from '@radix-ui/react-tabs'
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

const tabTrigger =
  'px-3 py-2 text-xs font-medium text-slate-400 border-b-2 border-transparent data-[state=active]:border-sky-500 data-[state=active]:text-slate-100 hover:text-slate-200'

function Workspace() {
  const project = useProjectStore((s) => s.project)
  const renameProject = useProjectStore((s) => s.renameProject)
  const ipPlan = useIpPlan()

  if (!project) return null

  return (
    <div className="flex h-full w-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-3 py-2">
        <div className="flex items-center gap-3">
          <input
            className="rounded border border-transparent bg-transparent px-1 text-sm font-semibold text-slate-100 hover:border-slate-700 focus:border-slate-600 focus:outline-none"
            value={project.projectName}
            onChange={(e) => renameProject(e.target.value)}
          />
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
            {project.settings.fabricMode === 'evpn' ? 'VXLAN EVPN' : 'Static VXLAN'}
          </span>
        </div>
        <ProjectMenu ipPlan={ipPlan} />
      </header>
      <ValidationBanner ipPlan={ipPlan} />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <TopologyCanvas />
        </div>
        <aside className="flex w-[26rem] flex-col border-l border-slate-800 bg-slate-950/60">
          <Tabs.Root defaultValue="inspector" className="flex min-h-0 flex-1 flex-col">
            <Tabs.List className="flex flex-wrap border-b border-slate-800">
              <Tabs.Trigger value="inspector" className={tabTrigger}>
                Inspector
              </Tabs.Trigger>
              <Tabs.Trigger value="ipplan" className={tabTrigger}>
                IP Plan
              </Tabs.Trigger>
              <Tabs.Trigger value="vlans" className={tabTrigger}>
                VLANs/VRFs
              </Tabs.Trigger>
              <Tabs.Trigger value="cli" className={tabTrigger}>
                CLI
              </Tabs.Trigger>
              <Tabs.Trigger value="settings" className={tabTrigger}>
                Settings
              </Tabs.Trigger>
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
      </div>
    </div>
  )
}

function App() {
  const project = useProjectStore((s) => s.project)
  return <div className="h-screen w-screen bg-slate-950">{project ? <Workspace /> : <ModeSelect />}</div>
}

export default App
