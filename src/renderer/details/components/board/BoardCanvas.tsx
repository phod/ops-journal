import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useViewport,
  type NodeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Node,
  type Edge,
  type Viewport,
  type NodeMouseHandler,
  SelectionMode
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import EntryNode from './nodes/EntryNode'
import TextBoxNode from './nodes/TextBoxNode'
import ImageNode from './nodes/ImageNode'
import ShapeNode from './nodes/ShapeNode'
import type { JournalEntry } from '@shared/ipc-types'
import type { EdgeArrowDirection } from '@shared/board-types'

const nodeTypes: NodeTypes = {
  entry: EntryNode,
  textbox: TextBoxNode,
  image: ImageNode,
  shape: ShapeNode
}

const EDGE_COLOR_DEFAULT = '#6b7280' // gray-500
const EDGE_COLOR_SELECTED = '#3b82f6' // blue-500 — matches shape selection ring

function arrowMarker(color: string): Edge['markerEnd'] {
  return { type: MarkerType.ArrowClosed, color, width: 20, height: 20 }
}

// ---------------------------------------------------------------------------
// Floating toolbar shown at the midpoint of the selected edge
// ---------------------------------------------------------------------------

const DIRECTION_OPTIONS: { value: EdgeArrowDirection; label: string; icon: string }[] = [
  { value: 'reverse', label: 'Reverse', icon: '←' },
  { value: 'forward', label: 'Forward', icon: '→' },
  { value: 'both', label: 'Both', icon: '↔' },
  { value: 'none', label: 'None', icon: '—' }
]

function EdgeDirectionToolbar({
  nodes,
  edges,
  onDirectionChange
}: {
  nodes: Node[]
  edges: Edge[]
  onDirectionChange: (edgeId: string, direction: EdgeArrowDirection) => void
}) {
  const { x: vpX, y: vpY, zoom } = useViewport()

  const selectedEdge = edges.find((e) => e.selected)
  if (!selectedEdge) return null

  const sourceNode = nodes.find((n) => n.id === selectedEdge.source)
  const targetNode = nodes.find((n) => n.id === selectedEdge.target)
  if (!sourceNode || !targetNode) return null

  // Compute center of each node in flow coordinates
  const sw = (sourceNode.style as { width?: number })?.width ?? sourceNode.width ?? sourceNode.measured?.width ?? 200
  const sh = (sourceNode.style as { height?: number })?.height ?? sourceNode.height ?? sourceNode.measured?.height ?? 70
  const tw = (targetNode.style as { width?: number })?.width ?? targetNode.width ?? targetNode.measured?.width ?? 200
  const th = (targetNode.style as { height?: number })?.height ?? targetNode.height ?? targetNode.measured?.height ?? 70

  const midFlowX = (sourceNode.position.x + sw / 2 + targetNode.position.x + tw / 2) / 2
  const midFlowY = (sourceNode.position.y + sh / 2 + targetNode.position.y + th / 2) / 2

  // Convert to container pixel coordinates
  const left = midFlowX * zoom + vpX
  const top = midFlowY * zoom + vpY

  const direction: EdgeArrowDirection = (selectedEdge.data as { arrowDirection?: EdgeArrowDirection })?.arrowDirection ?? 'forward'

  return (
    <div
      style={{ position: 'absolute', left, top, transform: 'translate(-50%, calc(-100% - 12px))', zIndex: 50, pointerEvents: 'auto' }}
      // Stop clicks from propagating to the pane (which would deselect the edge)
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center bg-gray-800 border border-gray-600 rounded-md shadow-lg overflow-hidden">
        {DIRECTION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onDirectionChange(selectedEdge.id, opt.value)}
            className={`px-2.5 py-1.5 text-sm transition-colors ${
              direction === opt.value
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
            }`}
            title={opt.label}
          >
            {opt.icon}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main canvas
// ---------------------------------------------------------------------------

interface Props {
  nodes: Node[]
  edges: Edge[]
  viewport: Viewport
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect
  onViewportChange: (viewport: Viewport) => void
  onDropEntry: (entryId: string, position: { x: number; y: number }) => void
  onAddTextBox: (position: { x: number; y: number }) => void
  onUpdateTextBox: (nodeId: string, text: string) => void
  onExplodeHypothesis: (nodeId: string) => void
  onUpdateShapeLabel: (nodeId: string, label: string) => void
  onBringToFront: (nodeId: string) => void
  onSendToBack: (nodeId: string) => void
  onBringForward: (nodeId: string) => void
  onSendBackward: (nodeId: string) => void
  onUpdateEdgeDirection: (edgeId: string, direction: EdgeArrowDirection) => void
  allEntries: JournalEntry[]
}

export function BoardCanvas({
  nodes,
  edges,
  viewport,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onViewportChange,
  onDropEntry,
  onAddTextBox,
  onUpdateTextBox,
  onExplodeHypothesis,
  onUpdateShapeLabel,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
  onUpdateEdgeDirection,
  allEntries
}: Props) {
  const reactFlowRef = useRef<HTMLDivElement>(null)
  const [minimapOpen, setMinimapOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null)

  useEffect(() => {
    window.electronAPI.getMinimapOpen().then(setMinimapOpen)
  }, [])

  const onNodeContextMenu: NodeMouseHandler = useCallback((event, node) => {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id })
  }, [])

  // Close context menu on click anywhere
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const entryId = e.dataTransfer.getData('application/x-board-entry')
      if (!entryId || !reactFlowRef.current) return

      const bounds = reactFlowRef.current.getBoundingClientRect()
      const position = {
        x: (e.clientX - bounds.left - viewport.x) / viewport.zoom,
        y: (e.clientY - bounds.top - viewport.y) / viewport.zoom
      }

      onDropEntry(entryId, position)
    },
    [viewport, onDropEntry]
  )

  // Apply per-edge arrow markers; blue when selected, gray otherwise
  const styledEdges: Edge[] = useMemo(() => edges.map((edge) => {
    const color = edge.selected ? EDGE_COLOR_SELECTED : EDGE_COLOR_DEFAULT
    const direction: EdgeArrowDirection = (edge.data as { arrowDirection?: EdgeArrowDirection })?.arrowDirection ?? 'forward'
    const showEnd = direction === 'forward' || direction === 'both'
    const showStart = direction === 'reverse' || direction === 'both'
    return {
      ...edge,
      style: { ...edge.style, stroke: color, strokeWidth: edge.selected ? 2.5 : 1.5 },
      markerEnd: showEnd ? arrowMarker(color) : undefined,
      markerStart: showStart ? arrowMarker(color) : undefined
    }
  }), [edges])

  // Wrap nodes so callbacks are wired up
  const nodesWithHandlers: Node[] = nodes.map((node) => {
    if (node.type === 'textbox') {
      return {
        ...node,
        data: {
          ...node.data,
          onChange: (text: string) => onUpdateTextBox(node.id, text)
        }
      }
    }
    if (node.type === 'entry') {
      return {
        ...node,
        data: {
          ...node.data,
          onExplode: () => onExplodeHypothesis(node.id)
        }
      }
    }
    if (node.type === 'shape') {
      return {
        ...node,
        data: {
          ...node.data,
          onChange: (label: string) => onUpdateShapeLabel(node.id, label)
        }
      }
    }
    return node
  })

  return (
    <div ref={reactFlowRef} className="flex-1 h-full" onDragOver={onDragOver} onDrop={onDrop}>
      <style>{`
        .react-flow__controls-button {
          background: #1f2937;
          border-bottom: 1px solid #374151;
          fill: #9ca3af;
        }
        .react-flow__controls-button:hover {
          background: #374151;
          fill: #d1d5db;
        }
        .react-flow__controls-button svg {
          fill: inherit;
        }
        .react-flow__minimap {
          border: 1px solid #334155 !important;
          border-radius: 10px !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.45), 0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04) !important;
          overflow: hidden;
        }
      `}</style>
      <ReactFlow
        nodes={nodesWithHandlers}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={() => setContextMenu(null)}
        onMoveEnd={(_, vp) => onViewportChange(vp)}
        defaultViewport={viewport}
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode={['Backspace', 'Delete']}
        proOptions={{ hideAttribution: true }}
        selectionMode={SelectionMode.Partial}
        className="bg-gray-900"
      >
        <Background color="#374151" gap={20} size={1} />
        <Controls style={{ border: '1px solid #374151', borderRadius: '6px', overflow: 'hidden' }} />
        {minimapOpen && (
          <MiniMap
            nodeColor={(n) => {
              if (n.type === 'entry') {
                const entry = (n.data as { entry?: { type?: string } | null }).entry
                if (entry?.type === 'finding') return '#2dd4bf'    // teal-400
                if (entry?.type === 'hypothesis') return '#8b5cf6' // violet-500
                if (entry?.type === 'action') return '#fb923c'     // orange-400
                return '#4b5563'
              }
              if (n.type === 'textbox') return '#374151'
              if (n.type === 'shape') return '#6b7280'
              return '#1f2937'
            }}
            bgColor="#1e293b"
            maskColor="rgba(0,0,0,0.5)"
          />
        )}
        <EdgeDirectionToolbar
          nodes={nodesWithHandlers}
          edges={styledEdges}
          onDirectionChange={onUpdateEdgeDirection}
        />
        <div className="react-flow__panel react-flow__panel-bottom-right" style={{ marginBottom: minimapOpen ? '148px' : '8px', marginRight: '8px' }}>
          <button
            onClick={() => setMinimapOpen((v) => {
              const next = !v
              window.electronAPI.setMinimapOpen(next)
              return next
            })}
            className="text-xs px-2 py-1 rounded bg-gray-800 border border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors"
            title={minimapOpen ? 'Hide minimap' : 'Show minimap'}
          >
            {minimapOpen ? 'Hide map' : 'Show map'}
          </button>
        </div>
      </ReactFlow>
      {contextMenu && (
        <div
          className="fixed z-50 bg-gray-800 border border-gray-600 rounded-md shadow-lg py-1 min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-700 transition-colors"
            onClick={() => { onBringToFront(contextMenu.nodeId); setContextMenu(null) }}
          >
            Bring to Front
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-700 transition-colors"
            onClick={() => { onBringForward(contextMenu.nodeId); setContextMenu(null) }}
          >
            Bring Forward
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-700 transition-colors"
            onClick={() => { onSendBackward(contextMenu.nodeId); setContextMenu(null) }}
          >
            Send Backward
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-700 transition-colors"
            onClick={() => { onSendToBack(contextMenu.nodeId); setContextMenu(null) }}
          >
            Send to Back
          </button>
        </div>
      )}
    </div>
  )
}
