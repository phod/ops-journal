import { useCallback, useRef, useState } from 'react'
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
  type Viewport
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import EntryNode from './nodes/EntryNode'
import TextBoxNode from './nodes/TextBoxNode'
import ImageNode from './nodes/ImageNode'
import type { JournalEntry } from '@shared/ipc-types'

const nodeTypes: NodeTypes = {
  entry: EntryNode,
  textbox: TextBoxNode,
  image: ImageNode
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
  allEntries
}: Props) {
  const reactFlowRef = useRef<HTMLDivElement>(null)
  const [minimapOpen, setMinimapOpen] = useState(false)

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

  // Wrap nodes so textbox onChange is wired up
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
      `}</style>
      <ReactFlow
        nodes={nodesWithHandlers}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMoveEnd={(_, vp) => onViewportChange(vp)}
        defaultViewport={viewport}
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode="Delete"
        proOptions={{ hideAttribution: true }}
        className="bg-gray-900"
      >
        <Background color="#374151" gap={20} size={1} />
        <Controls style={{ border: '1px solid #374151', borderRadius: '6px', overflow: 'hidden' }} />
        {minimapOpen && (
          <MiniMap
            nodeColor={(n) => {
              if (n.type === 'entry') return '#4b5563'
              if (n.type === 'textbox') return '#374151'
              return '#1f2937'
            }}
            style={{ border: '1px solid #4b5563', borderRadius: '6px', backgroundColor: '#111827' }}
          />
        )}
        <div className="react-flow__panel react-flow__panel-bottom-right" style={{ marginBottom: minimapOpen ? '148px' : '8px', marginRight: '8px' }}>
          <button
            onClick={() => setMinimapOpen((v) => !v)}
            className="text-xs px-2 py-1 rounded bg-gray-800 border border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors"
            title={minimapOpen ? 'Hide minimap' : 'Show minimap'}
          >
            {minimapOpen ? 'Hide map' : 'Show map'}
          </button>
        </div>
      </ReactFlow>
    </div>
  )
}
