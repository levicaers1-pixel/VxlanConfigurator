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

interface ProjectStore {
  project: Project | null

  startProject: (fabricMode: FabricMode) => void
  loadProject: (project: Project) => void
  closeProject: () => void
  renameProject: (name: string) => void
  updateSettings: (patch: Partial<ProjectSettings>) => void

  addSwitch: (catalogId: string, role: SwitchRole, position: { x: number; y: number }) => string
  updateSwitch: (id: string, patch: Partial<SwitchInstance>) => void
  removeSwitch: (id: string) => void
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

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,

  startProject: (fabricMode) => set({ project: newProject(fabricMode) }),
  loadProject: (project) => set({ project }),
  closeProject: () => set({ project: null }),
  renameProject: (name) =>
    set((state) => (state.project ? { project: touch({ ...state.project, projectName: name }) } : state)),
  updateSettings: (patch) =>
    set((state) =>
      state.project
        ? { project: touch({ ...state.project, settings: { ...state.project.settings, ...patch } }) }
        : state,
    ),

  addSwitch: (catalogId, role, position) => {
    const id = uuidv4()
    set((state) => {
      if (!state.project) return state
      const existingOfRole = state.project.switches.filter((s) => s.role === role)
      const sequence = existingOfRole.length + 1
      const name = `${role.toUpperCase()}${sequence}`
      const instance: SwitchInstance = { id, catalogId, name, role, sequence, position }
      return { project: touch({ ...state.project, switches: [...state.project.switches, instance] }) }
    })
    return id
  },

  updateSwitch: (id, patch) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: touch({
          ...state.project,
          switches: state.project.switches.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        }),
      }
    }),

  removeSwitch: (id) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: touch({
          ...state.project,
          switches: state.project.switches.filter((s) => s.id !== id),
          links: state.project.links.filter((l) => l.a.switchInstanceId !== id && l.b.switchInstanceId !== id),
        }),
      }
    }),

  setVsxPair: (idA, idB) => {
    const groupId = uuidv4()
    get().updateSwitch(idA, { vsxGroupId: groupId })
    get().updateSwitch(idB, { vsxGroupId: groupId })
  },

  clearVsxPair: (id) => {
    const state = get()
    if (!state.project) return
    const sw = state.project.switches.find((s) => s.id === id)
    if (!sw?.vsxGroupId) return
    const groupId = sw.vsxGroupId
    for (const member of state.project.switches.filter((s) => s.vsxGroupId === groupId)) {
      get().updateSwitch(member.id, { vsxGroupId: undefined })
    }
  },

  addLink: (a, b, kind) => {
    const id = uuidv4()
    set((state) => {
      if (!state.project) return state
      const link: Link = { id, a, b, kind }
      return { project: touch({ ...state.project, links: [...state.project.links, link] }) }
    })
    return id
  },

  updateLink: (id, patch) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: touch({
          ...state.project,
          links: state.project.links.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        }),
      }
    }),

  removeLink: (id) =>
    set((state) => {
      if (!state.project) return state
      return { project: touch({ ...state.project, links: state.project.links.filter((l) => l.id !== id) }) }
    }),

  addVlan: (vlan) => {
    const id = uuidv4()
    set((state) => {
      if (!state.project) return state
      return { project: touch({ ...state.project, vlans: [...state.project.vlans, { id, ...vlan }] }) }
    })
    return id
  },

  updateVlan: (id, patch) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: touch({
          ...state.project,
          vlans: state.project.vlans.map((v) => (v.id === id ? { ...v, ...patch } : v)),
        }),
      }
    }),

  removeVlan: (id) =>
    set((state) => {
      if (!state.project) return state
      return { project: touch({ ...state.project, vlans: state.project.vlans.filter((v) => v.id !== id) }) }
    }),

  addVrf: (vrf) => {
    const id = uuidv4()
    set((state) => {
      if (!state.project) return state
      return { project: touch({ ...state.project, vrfs: [...state.project.vrfs, { id, ...vrf }] }) }
    })
    return id
  },

  updateVrf: (id, patch) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: touch({
          ...state.project,
          vrfs: state.project.vrfs.map((v) => (v.id === id ? { ...v, ...patch } : v)),
        }),
      }
    }),

  removeVrf: (id) =>
    set((state) => {
      if (!state.project) return state
      return { project: touch({ ...state.project, vrfs: state.project.vrfs.filter((v) => v.id !== id) }) }
    }),
}))
