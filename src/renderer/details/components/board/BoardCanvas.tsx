import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
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

const nodeTypes: NodeTypes = {
  entry: EntryNode,
  textbox: TextBoxNode,
  image: ImageNode,
  shape: ShapeNode
}

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
      // We need to convert from screen coords to flow coords via the viewport transform
      // The position relative to the container
      const position = {
        x: (e.clientX - bounds.left - viewport.x) / viewport.zoom,
        y: (e.clientY - bounds.top - viewport.y) / viewport.zoom
      }

      onDropEntry(entryId, position)
    },
    [viewport, onDropEntry]
  )

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
        edges={edges}
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
