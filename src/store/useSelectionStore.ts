import { create } from 'zustand'

interface SelectionStore {
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectNode: (id: string | null) => void
  selectEdge: (id: string | null) => void

  /** Bumped whenever something outside the canvas (e.g. a Visio import) wants the viewport to re-fit around the current nodes. */
  fitViewRequestId: number
  requestFitView: () => void
}

export const useSelectionStore = create<SelectionStore>((set) => ({
  selectedNodeId: null,
  selectedEdgeId: null,
  selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

  fitViewRequestId: 0,
  requestFitView: () => set((s) => ({ fitViewRequestId: s.fitViewRequestId + 1 })),
}))
