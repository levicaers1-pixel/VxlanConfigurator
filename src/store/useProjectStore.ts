import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type {
  FabricMode,
  Link,
  LinkKind,
  Project,
  ProjectSettings,
  SwitchInstance,
  SwitchRole,
  TenantVrf,
  VlanMapping,
} from '../domain/types'

function defaultSettings(fabricMode: FabricMode): ProjectSettings {
  return {
    fabricMode,
    underlayProtocol: 'ebgp',
    asnScheme: 'per-device-unique',
    baseAsn: 65000,
    ospfProcessId: 1,
    ospfArea: '0.0.0.0',
    pools: {
      underlayP2P: { supernet: '10.0.0.0/16', description: 'Underlay point-to-point links' },
      loopback: { supernet: '10.255.0.0/24', description: 'Router-ID / VTEP source loopbacks' },
      vsxKeepalive: { supernet: '10.255.255.0/24', description: 'VSX keepalive links' },
      mgmt: { supernet: '192.168.1.0/24', description: 'Out-of-band management (informational)' },
      tenantSubnets: { supernet: '10.10.0.0/16', description: 'Tenant VLAN subnets' },
    },
    tenantSubnetPrefixLen: 24,
    vniAllocation: {
      l2VniStrategy: 'vlan-plus-offset',
      l2VniOffset: 10000,
      l3VniPoolStart: 100000,
    },
    jumboMtu: true,
  }
}

export function newProject(fabricMode: FabricMode): Project {
  const now = new Date().toISOString()
  return {
    formatVersion: 1,
    projectName: 'Untitled Fabric',
    createdAt: now,
    updatedAt: now,
    settings: defaultSettings(fabricMode),
    switches: [],
    links: [],
    vlans: [],
    vrfs: [],
  }
}

const MAX_HISTORY = 50
const HISTORY_COALESCE_MS = 400

interface ProjectStore {
  project: Project | null
  past: Project[]
  future: Project[]

  startProject: (fabricMode: FabricMode) => void
  loadProject: (project: Project) => void
  closeProject: () => void
  undo: () => void
  redo: () => void

  renameProject: (name: string) => void
  updateSettings: (patch: Partial<ProjectSettings>) => void

  addSwitch: (catalogId: string, role: SwitchRole, position: { x: number; y: number }) => string
  updateSwitch: (id: string, patch: Partial<SwitchInstance>) => void
  removeSwitch: (id: string) => void
  duplicateSwitch: (id: string, offset?: { x: number; y: number }) => string | undefined
  setVsxPair: (idA: string, idB: string) => void
  clearVsxPair: (id: string) => void

  addLink: (a: Link['a'], b: Link['b'], kind: LinkKind) => string
  updateLink: (id: string, patch: Partial<Link>) => void
  removeLink: (id: string) => void

  addVlan: (vlan: Omit<VlanMapping, 'id'>) => string
  updateVlan: (id: string, patch: Partial<VlanMapping>) => void
  removeVlan: (id: string) => void

  addVrf: (vrf: Omit<TenantVrf, 'id'>) => string
  updateVrf: (id: string, patch: Partial<TenantVrf>) => void
  removeVrf: (id: string) => void
}

function touch(project: Project): Project {
  return { ...project, updatedAt: new Date().toISOString() }
}

let lastHistoryPush = 0

export const useProjectStore = create<ProjectStore>((set, get) => {
  /** Applies `updater` to the current project, recording an undo step (coalesced within a short window). */
  function mutate(updater: (project: Project) => Project) {
    const state = get()
    if (!state.project) return
    const now = Date.now()
    const coalesce = now - lastHistoryPush < HISTORY_COALESCE_MS
    lastHistoryPush = now
    const past = coalesce ? state.past : [...state.past, state.project].slice(-MAX_HISTORY)
    set({ project: touch(updater(state.project)), past, future: [] })
  }

  return {
    project: null,
    past: [],
    future: [],

    startProject: (fabricMode) => set({ project: newProject(fabricMode), past: [], future: [] }),
    loadProject: (project) => set({ project, past: [], future: [] }),
    closeProject: () => set({ project: null, past: [], future: [] }),

    undo: () =>
      set((state) => {
        if (state.past.length === 0 || !state.project) return state
        const previous = state.past[state.past.length - 1]
        return { project: previous, past: state.past.slice(0, -1), future: [state.project, ...state.future] }
      }),
    redo: () =>
      set((state) => {
        if (state.future.length === 0 || !state.project) return state
        const [next, ...rest] = state.future
        return { project: next, past: [...state.past, state.project].slice(-MAX_HISTORY), future: rest }
      }),

    renameProject: (name) => mutate((project) => ({ ...project, projectName: name })),
    updateSettings: (patch) => mutate((project) => ({ ...project, settings: { ...project.settings, ...patch } })),

    addSwitch: (catalogId, role, position) => {
      const id = uuidv4()
      mutate((project) => {
        const existingOfRole = project.switches.filter((s) => s.role === role)
        const sequence = existingOfRole.length + 1
        const name = `${role.toUpperCase()}${sequence}`
        const instance: SwitchInstance = { id, catalogId, name, role, sequence, position }
        return { ...project, switches: [...project.switches, instance] }
      })
      return id
    },

    updateSwitch: (id, patch) =>
      mutate((project) => ({
        ...project,
        switches: project.switches.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      })),

    removeSwitch: (id) =>
      mutate((project) => ({
        ...project,
        switches: project.switches.filter((s) => s.id !== id),
        links: project.links.filter((l) => l.a.switchInstanceId !== id && l.b.switchInstanceId !== id),
      })),

    duplicateSwitch: (id, offset = { x: 40, y: 40 }) => {
      const state = get()
      const source = state.project?.switches.find((s) => s.id === id)
      if (!source) return undefined
      const newId = uuidv4()
      mutate((project) => {
        const existingOfRole = project.switches.filter((s) => s.role === source.role)
        const sequence = existingOfRole.length + 1
        const clone: SwitchInstance = {
          ...source,
          id: newId,
          name: `${source.role.toUpperCase()}${sequence}`,
          sequence,
          vsxGroupId: undefined,
          position: { x: source.position.x + offset.x, y: source.position.y + offset.y },
        }
        return { ...project, switches: [...project.switches, clone] }
      })
      return newId
    },

    setVsxPair: (idA, idB) => {
      const groupId = uuidv4()
      mutate((project) => ({
        ...project,
        switches: project.switches.map((s) => (s.id === idA || s.id === idB ? { ...s, vsxGroupId: groupId } : s)),
        // Any direct link already drawn between this pair almost certainly IS
        // the intended ISL — retag it so `vsx.ts` picks it up automatically
        // instead of silently omitting the ISL trunk config.
        links: project.links.map((l) => {
          const directPair =
            (l.a.switchInstanceId === idA && l.b.switchInstanceId === idB) ||
            (l.a.switchInstanceId === idB && l.b.switchInstanceId === idA)
          if (directPair && (l.kind === 'underlay-p2p' || l.kind === 'unassigned')) {
            return { ...l, kind: 'vsx-isl' as const }
          }
          return l
        }),
      }))
    },

    clearVsxPair: (id) => {
      const state = get()
      const sw = state.project?.switches.find((s) => s.id === id)
      if (!sw?.vsxGroupId) return
      const groupId = sw.vsxGroupId
      mutate((project) => ({
        ...project,
        switches: project.switches.map((s) => (s.vsxGroupId === groupId ? { ...s, vsxGroupId: undefined } : s)),
      }))
    },

    addLink: (a, b, kind) => {
      const id = uuidv4()
      mutate((project) => ({ ...project, links: [...project.links, { id, a, b, kind }] }))
      return id
    },

    updateLink: (id, patch) =>
      mutate((project) => ({ ...project, links: project.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),

    removeLink: (id) => mutate((project) => ({ ...project, links: project.links.filter((l) => l.id !== id) })),

    addVlan: (vlan) => {
      const id = uuidv4()
      mutate((project) => ({ ...project, vlans: [...project.vlans, { id, ...vlan }] }))
      return id
    },

    updateVlan: (id, patch) =>
      mutate((project) => ({ ...project, vlans: project.vlans.map((v) => (v.id === id ? { ...v, ...patch } : v)) })),

    removeVlan: (id) => mutate((project) => ({ ...project, vlans: project.vlans.filter((v) => v.id !== id) })),

    addVrf: (vrf) => {
      const id = uuidv4()
      mutate((project) => ({ ...project, vrfs: [...project.vrfs, { id, ...vrf }] }))
      return id
    },

    updateVrf: (id, patch) =>
      mutate((project) => ({ ...project, vrfs: project.vrfs.map((v) => (v.id === id ? { ...v, ...patch } : v)) })),

    removeVrf: (id) => mutate((project) => ({ ...project, vrfs: project.vrfs.filter((v) => v.id !== id) })),
  }
})
