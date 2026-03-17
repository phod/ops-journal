import { memo, useEffect, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { getEntryTypeDefinition } from '@shared/entry-types'
import type { JournalEntry } from '@shared/ipc-types'
import { NodeDeleteButton } from './NodeDeleteButton'

export interface EntryNodeData {
  entry: JournalEntry | null
  entryId: string
  onExplode?: () => void
}

function EntryNode({ id, data, selected }: NodeProps) {
  const { entry, onExplode } = data as EntryNodeData
  const [imageDataUrls, setImageDataUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!entry?.image_paths.length) return
    for (const path of entry.image_paths) {
      if (!imageDataUrls[path]) {
        window.electronAPI.getEntryImage(path).then((dataUrl) => {
          setImageDataUrls((prev) => ({ ...prev, [path]: dataUrl }))
        }).catch(() => {})
      }
    }
  }, [entry?.image_paths])

  const isHypothesis = entry?.type === 'hypothesis'
  const hasRelations = isHypothesis && (
    (entry.linked_finding_ids?.length ?? 0) > 0 ||
    (entry.linked_child_hypothesis_ids?.length ?? 0) > 0 ||
    (entry.parent_hypothesis_ids?.length ?? 0) > 0
  )

  if (!entry) {
    return (
      <div className={`relative rounded border px-3 py-2 min-w-[180px] max-w-[280px] bg-gray-800 border-gray-600 ${selected ? 'ring-2 ring-blue-500' : ''}`}>
        {selected && <NodeDeleteButton nodeId={id} />}
        <Handle type="target" position={Position.Top} />
        <Handle type="target" position={Position.Left} id="left-target" />
        <span className="text-xs text-gray-500 italic">[deleted entry]</span>
        <Handle type="source" position={Position.Bottom} />
        <Handle type="source" position={Position.Right} id="right-source" />
      </div>
    )
  }

  const def = getEntryTypeDefinition(entry.type)
  const truncated = entry.body.length > 120 ? entry.body.slice(0, 120) + '…' : entry.body
  const hasImages = entry.image_paths.length > 0

  return (
    <div
      className={`relative rounded border px-3 py-2 min-w-[180px] max-w-[280px] ${def.cardBgClass || 'bg-gray-800/80'} ${def.cardBorderClass || 'border-gray-600'} ${selected ? 'ring-2 ring-blue-500' : ''}`}
    >
      {selected && <NodeDeleteButton nodeId={id} />}
      <Handle type="target" position={Position.Top} style={{ background: '#4b5563' }} />
      <Handle type="target" position={Position.Left} id="left-target" style={{ background: '#4b5563' }} />
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${def.tagBgClass} ${def.tagTextClass}`}>
          {def.label}
        </span>
        {entry.flagged && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
            <line x1="4" y1="22" x2="4" y2="15"/>
          </svg>
        )}
        {hasImages && (
          <span className="text-xs text-gray-500">📷 {entry.image_paths.length}</span>
        )}
      </div>
      <p className="text-xs text-gray-200 leading-relaxed whitespace-pre-wrap break-words">{truncated}</p>
      {hasImages && (
        <div className="mt-1.5 flex flex-col gap-1.5">
          {entry.image_paths.map((path) => (
            <div key={path} className="rounded-lg border border-gray-600 overflow-hidden bg-gray-900">
              {imageDataUrls[path] ? (
                <img
                  src={imageDataUrls[path]}
                  alt=""
                  className="w-full object-cover"
                  onContextMenu={(e) => { e.preventDefault(); window.electronAPI.showImageContextMenu(path) }}
                />
              ) : (
                <div className="w-full h-[120px] flex items-center justify-center text-gray-500 text-[10px]">
                  Loading…
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {selected && hasRelations && (
        <button
          onClick={(e) => { e.stopPropagation(); onExplode?.() }}
          className="mt-2 w-full text-xs px-2 py-1 rounded bg-violet-500/30 border border-violet-400/50 text-violet-200 hover:bg-violet-500/50 hover:text-violet-100 transition-colors font-medium"
        >
          Explode
        </button>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#4b5563' }} />
      <Handle type="source" position={Position.Right} id="right-source" style={{ background: '#4b5563' }} />
    </div>
  )
}

export default memo(EntryNode)
