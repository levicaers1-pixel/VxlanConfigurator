import { useCallback, useMemo, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  ConnectionMode,
  applyNodeChanges,
  useReactFlow,
  type NodeChange,
  type OnConnect,
  type OnReconnect,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useProjectStore } from '../store/useProjectStore'
import { useSelectionStore } from '../store/useSelectionStore'
import { SwitchNode, type SwitchNodeType } from './nodes/SwitchNode'
import { LinkEdge, type LinkEdgeType } from './edges/LinkEdge'
import { Palette, DRAG_MIME } from './Palette'
import { checkConnectPorts } from './linkValidation'
import { computeAutoLayout } from './autoLayout'
import { CanvasToolbar } from './CanvasToolbar'
import { Legend } from './Legend'
import type { Link, LinkKind, SwitchRole } from '../domain/types'

const nodeTypes = { switchNode: SwitchNode }
const edgeTypes = { linkEdge: LinkEdge }

function defaultKindFor(switchAId: string, switchBId: string, project: NonNullable<ReturnType<typeof useProjectStore.getState>['project']>): LinkKind {
  const a = project.switches.find((s) => s.id === switchAId)
  const b = project.switches.find((s) => s.id === switchBId)
  return a?.vsxGroupId && a.vsxGroupId === b?.vsxGroupId ? 'vsx-isl' : 'underlay-p2p'
}

function portStatusFor(switchId: string, links: Link[]): Record<string, LinkKind> {
  const status: Record<string, LinkKind> = {}
  for (const link of links) {
    if (link.a.switchInstanceId === switchId) status[link.a.portName] = link.kind
    if (link.b.switchInstanceId === switchId) status[link.b.portName] = link.kind
  }
  return status
}

function CanvasInner() {
  const project = useProjectStore((s) => s.project)
  const addSwitch = useProjectStore((s) => s.addSwitch)
  const updateSwitch = useProjectStore((s) => s.updateSwitch)
  const removeSwitch = useProjectStore((s) => s.removeSwitch)
  const addLink = useProjectStore((s) => s.addLink)
  const updateLink = useProjectStore((s) => s.updateLink)
  const removeLink = useProjectStore((s) => s.removeLink)
  const selectNode = useSelectionStore((s) => s.selectNode)
  const selectEdge = useSelectionStore((s) => s.selectEdge)
  const selectedNodeId = useSelectionStore((s) => s.selectedNodeId)
  const selectedEdgeId = useSelectionStore((s) => s.selectedEdgeId)
  const [snapEnabled, setSnapEnabled] = useState(false)
  const [legendVisible, setLegendVisible] = useState(true)

  const nodes: SwitchNodeType[] = useMemo(
    () =>
      (project?.switches ?? []).map((sw) => ({
        id: sw.id,
        type: 'switchNode',
        position: sw.position,
        // Reflects our own selection store so react-flow's internal delete-key
        // handling (which reads `.selected` off these controlled props) works.
        selected: sw.id === selectedNodeId,
        data: {
          catalogId: sw.catalogId,
          role: sw.role,
          name: sw.name,
          vsxGroupId: sw.vsxGroupId,
          portStatus: portStatusFor(sw.id, project?.links ?? []),
        },
      })),
    [project?.switches, project?.links, selectedNodeId],
  )

  const edges: LinkEdgeType[] = useMemo(
    () =>
      (project?.links ?? []).map((link) => ({
        id: link.id,
        source: link.a.switchInstanceId,
        sourceHandle: link.a.portName,
        target: link.b.switchInstanceId,
        targetHandle: link.b.portName,
        type: 'linkEdge',
        reconnectable: true,
        selected: link.id === selectedEdgeId,
        data: { kind: link.kind, onDelete: () => removeLink(link.id) },
      })),
    [project?.links, selectedEdgeId, removeLink],
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
      if (!project) return
      const { source, target, sourceHandle, targetHandle } = connection
      if (!source || !target || !sourceHandle || !targetHandle) return
      const switchA = project.switches.find((s) => s.id === source)
      const switchB = project.switches.find((s) => s.id === target)
      if (!switchA || !switchB) return
      const check = checkConnectPorts(switchA, sourceHandle, switchB, targetHandle, project.links)
      if (!check.ok) {
        window.alert(check.reason)
        return
      }
      const kind = defaultKindFor(source, target, project)
      addLink({ switchInstanceId: source, portName: sourceHandle }, { switchInstanceId: target, portName: targetHandle }, kind)
    },
    [project, addLink],
  )

  const onReconnect: OnReconnect<LinkEdgeType> = useCallback(
    (oldEdge, newConnection) => {
      if (!project) return
      const { source, target, sourceHandle, targetHandle } = newConnection
      if (!source || !target || !sourceHandle || !targetHandle) return
      const switchA = project.switches.find((s) => s.id === source)
      const switchB = project.switches.find((s) => s.id === target)
      if (!switchA || !switchB) return
      const check = checkConnectPorts(switchA, sourceHandle, switchB, targetHandle, project.links, oldEdge.id)
      if (!check.ok) {
        window.alert(check.reason)
        return
      }
      updateLink(oldEdge.id, {
        a: { switchInstanceId: source, portName: sourceHandle },
        b: { switchInstanceId: target, portName: targetHandle },
      })
    },
    [project, updateLink],
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

  const onAutoLayout = useCallback(() => {
    if (!project) return
    const positions = computeAutoLayout(project.switches)
    for (const [id, position] of Object.entries(positions)) {
      updateSwitch(id, { position })
    }
  }, [project, updateSwitch])

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
          onReconnect={onReconnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={['Backspace', 'Delete']}
          snapToGrid={snapEnabled}
          snapGrid={[16, 16]}
          colorMode="dark"
          fitView
        >
          <Background />
          <Controls />
          <MiniMap pannable zoomable position="top-right" className="!bg-slate-900" />
          <Panel position="top-left">
            <CanvasToolbar
              onAutoLayout={onAutoLayout}
              snapEnabled={snapEnabled}
              onToggleSnap={() => setSnapEnabled((v) => !v)}
              legendVisible={legendVisible}
              onToggleLegend={() => setLegendVisible((v) => !v)}
            />
          </Panel>
          {legendVisible && (
            <Panel position="bottom-left">
              <Legend />
            </Panel>
          )}
        </ReactFlow>
        {(project?.switches.length ?? 0) === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 px-6 py-5 text-center">
              <p className="text-sm font-medium text-slate-400">Drag a switch here to get started</p>
              <p className="mt-1 text-xs text-slate-600">Then wire ports together by dragging between them</p>
            </div>
          </div>
        )}
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
