import { useCallback, useMemo, useState } from 'react'
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant } from '@xyflow/react'
import type { NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { JournalEntry, HypothesisStatus } from '@shared/ipc-types'
import { useRelationshipGraph } from './useRelationshipGraph'
import { RelationshipNode } from './RelationshipNode'
import { RelationshipDetailPanel } from './RelationshipDetailPanel'

const nodeTypes = { relationship: RelationshipNode }

const STATUS_FILTERS: { key: HypothesisStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'true', label: 'True' },
  { key: 'false', label: 'False' },
  { key: 'abandoned', label: 'Abandoned' }
]

interface RelationshipMapViewProps {
  entries: JournalEntry[]
}

function RelationshipMapInner({ entries }: RelationshipMapViewProps): JSX.Element {
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<HypothesisStatus | 'all'>('all')

  const { nodes: rawNodes, edges: rawEdges } = useRelationshipGraph(entries, statusFilter)

  // Compute connected node IDs when a node is focused
  const connectedIds = useMemo(() => {
    if (!focusedNodeId) return null
    const ids = new Set<string>([focusedNodeId])
    rawEdges.forEach((edge) => {
      if (edge.source === focusedNodeId || edge.target === focusedNodeId) {
        ids.add(edge.source)
        ids.add(edge.target)
      }
    })
    return ids
  }, [focusedNodeId, rawEdges])

  // Apply focus dimming to nodes
  const nodes = useMemo(() => {
    return rawNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onFocus: setFocusedNodeId,
        dimmed: connectedIds ? !connectedIds.has(node.id) : false
      }
    }))
  }, [rawNodes, connectedIds])

  // Apply focus dimming to edges
  const edges = useMemo(() => {
    if (!connectedIds) return rawEdges
    return rawEdges.map((edge) => ({
      ...edge,
      style: {
        ...edge.style,
        opacity: connectedIds.has(edge.source) && connectedIds.has(edge.target) ? 1 : 0.15
      }
    }))
  }, [rawEdges, connectedIds])

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setFocusedNodeId(node.id)
  }, [])

  const onPaneClick = useCallback(() => {
    setFocusedNodeId(null)
  }, [])

  const focusedEntry = focusedNodeId
    ? entries.find((e) => e.id === focusedNodeId) ?? null
    : null

  const hasHypotheses = entries.some((e) => e.type === 'hypothesis')

  return (
    <div className="relative w-full h-full">
      {/* Filter bar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-gray-800/90 rounded-lg border border-gray-700/50 px-1.5 py-1">
        {STATUS_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`text-[10px] px-2 py-1 rounded font-medium transition-colors ${
              statusFilter === key
                ? 'bg-gray-600 text-gray-100'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {!hasHypotheses && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="text-center">
            <div className="text-gray-500 text-sm font-mono">No hypotheses found</div>
            <div className="text-gray-600 text-xs mt-1">
              Create hypotheses with linked findings and actions to see the relationship map
            </div>
          </div>
        </div>
      )}

      {/* ReactFlow canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        fitView
        panOnDrag
        zoomOnScroll
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#374151" />
      </ReactFlow>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 bg-gray-800/90 rounded-lg border border-gray-700/50 px-3 py-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#8b5cf6' }} />
            <span className="text-[10px] text-gray-400">Hypothesis</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#2dd4bf' }} />
            <span className="text-[10px] text-gray-400">Finding</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#fb923c' }} />
            <span className="text-[10px] text-gray-400">Action</span>
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {focusedEntry && (
        <RelationshipDetailPanel
          entry={focusedEntry}
          allEntries={entries}
          onFocusEntry={setFocusedNodeId}
          onClose={() => setFocusedNodeId(null)}
        />
      )}
    </div>
  )
}

export function RelationshipMapView(props: RelationshipMapViewProps): JSX.Element {
  return (
    <ReactFlowProvider>
      <RelationshipMapInner {...props} />
    </ReactFlowProvider>
  )
}
