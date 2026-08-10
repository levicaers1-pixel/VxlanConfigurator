import { create } from 'zustand'

interface SelectionStore {
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectNode: (id: string | null) => void
  selectEdge: (id: string | null) => void
}

export const useSelectionStore = create<SelectionStore>((set) => ({
  selectedNodeId: null,
  selectedEdgeId: null,
  selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),
}))
