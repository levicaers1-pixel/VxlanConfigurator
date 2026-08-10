import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  applyNodeChanges,
  useReactFlow,
  type NodeChange,
  type OnConnect,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useProjectStore } from '../store/useProjectStore'
import { useSelectionStore } from '../store/useSelectionStore'
import { SwitchNode, type SwitchNodeType } from './nodes/SwitchNode'
import { LinkEdge, type LinkEdgeType } from './edges/LinkEdge'
import { Palette, DRAG_MIME } from './Palette'
import { checkConnect } from './linkValidation'
import type { SwitchRole } from '../domain/types'

const nodeTypes = { switchNode: SwitchNode }
const edgeTypes = { linkEdge: LinkEdge }

function CanvasInner() {
  const project = useProjectStore((s) => s.project)
  const addSwitch = useProjectStore((s) => s.addSwitch)
  const updateSwitch = useProjectStore((s) => s.updateSwitch)
  const removeSwitch = useProjectStore((s) => s.removeSwitch)
  const addLink = useProjectStore((s) => s.addLink)
  const removeLink = useProjectStore((s) => s.removeLink)
  const selectNode = useSelectionStore((s) => s.selectNode)
  const selectEdge = useSelectionStore((s) => s.selectEdge)

  const nodes: SwitchNodeType[] = useMemo(
    () =>
      (project?.switches ?? []).map((sw) => ({
        id: sw.id,
        type: 'switchNode',
        position: sw.position,
        data: { catalogId: sw.catalogId, role: sw.role, name: sw.name, vsxGroupId: sw.vsxGroupId },
      })),
    [project?.switches],
  )

  const edges: LinkEdgeType[] = useMemo(
    () =>
      (project?.links ?? []).map((link) => ({
        id: link.id,
        source: link.a.switchInstanceId,
        target: link.b.switchInstanceId,
        type: 'linkEdge',
        data: { kind: link.kind },
      })),
    [project?.links],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange<SwitchNodeType>[]) => {
      const next = applyNodeChanges(changes, nodes)
      for (const change of changes) {
        if (change.type === 'position' && change.dragging === false) {
          const updated = next.find((n) => n.id === change.id)
          if (updated) updateSwitch(change.id, { position: updated.position })
        }
      }
    },
    [nodes, updateSwitch],
  )

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (!project || !connection.source || !connection.target) return
      const switchA = project.switches.find((s) => s.id === connection.source)
      const switchB = project.switches.find((s) => s.id === connection.target)
      if (!switchA || !switchB) return
      const check = checkConnect(switchA, switchB, project.links)
      if (!check.ok) {
        window.alert(check.reason)
        return
      }
      const kind = switchA.vsxGroupId && switchA.vsxGroupId === switchB.vsxGroupId ? 'vsx-isl' : 'underlay-p2p'
      addLink(
        { switchInstanceId: switchA.id, portName: check.portA! },
        { switchInstanceId: switchB.id, portName: check.portB! },
        kind,
      )
    },
    [project, addLink],
  )

  const onNodeClick: NodeMouseHandler<SwitchNodeType> = useCallback((_e, node) => selectNode(node.id), [selectNode])
  const onEdgeClick: EdgeMouseHandler<LinkEdgeType> = useCallback((_e, edge) => selectEdge(edge.id), [selectEdge])
  const onPaneClick = useCallback(() => {
    selectNode(null)
    selectEdge(null)
  }, [selectNode, selectEdge])

  const onNodesDelete = useCallback(
    (deleted: SwitchNodeType[]) => {
      for (const n of deleted) removeSwitch(n.id)
    },
    [removeSwitch],
  )
  const onEdgesDelete = useCallback(
    (deleted: LinkEdgeType[]) => {
      for (const e of deleted) removeLink(e.id)
    },
    [removeLink],
  )

  const { screenToFlowPosition } = useReactFlow()

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const raw = e.dataTransfer.getData(DRAG_MIME)
      if (!raw) return
      const { catalogId, role } = JSON.parse(raw) as { catalogId: string; role: SwitchRole }
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      addSwitch(catalogId, role, position)
    },
    [addSwitch, screenToFlowPosition],
  )

  return (
    <div className="flex h-full w-full">
      <Palette />
      <div className="relative flex-1" onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={['Backspace', 'Delete']}
          colorMode="dark"
          fitView
        >
          <Background />
          <Controls />
          <MiniMap pannable zoomable position="top-right" className="!bg-slate-900" />
        </ReactFlow>
      </div>
    </div>
  )
}

export function TopologyCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}
