import { create } from 'zustand'

interface SelectionStore {
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectNode: (id: string | null) => void
  selectEdge: (id: string | null) => void

  /** Bumped whenever something outside the canvas (e.g. a Visio import) wants the viewport to re-fit around the current nodes. */
  fitViewRequestId: number
  requestFitView: () => void

  /**
   * Catalog id of the palette card currently being dragged, if any. Native
   * HTML5 drag-and-drop only exposes the dragged payload on `drop` (browsers
   * block reading `dataTransfer` data during `dragover` for security), so the
   * canvas can't otherwise know which model to preview while the cursor is
   * still moving over it. Set on dragstart, cleared on dragend (which always
   * fires, drop or not).
   */
  draggingCatalogId: string | null
  setDraggingCatalogId: (id: string | null) => void
}

export const useSelectionStore = create<SelectionStore>((set) => ({
  selectedNodeId: null,
  selectedEdgeId: null,
  selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

  fitViewRequestId: 0,
  requestFitView: () => set((s) => ({ fitViewRequestId: s.fitViewRequestId + 1 })),

  draggingCatalogId: null,
  setDraggingCatalogId: (id) => set({ draggingCatalogId: id }),
}))
