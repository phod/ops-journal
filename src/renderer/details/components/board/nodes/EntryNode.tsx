import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { getEntryTypeDefinition } from '@shared/entry-types'
import type { JournalEntry } from '@shared/ipc-types'

export interface EntryNodeData {
  entry: JournalEntry | null
  entryId: string
}

function EntryNode({ data, selected }: NodeProps) {
  const { entry } = data as EntryNodeData

  if (!entry) {
    return (
      <div className={`rounded border px-3 py-2 min-w-[180px] max-w-[280px] bg-gray-800 border-gray-600 ${selected ? 'ring-2 ring-blue-500' : ''}`}>
        <Handle type="target" position={Position.Top} />
        <span className="text-xs text-gray-500 italic">[deleted entry]</span>
        <Handle type="source" position={Position.Bottom} />
      </div>
    )
  }

  const def = getEntryTypeDefinition(entry.type)
  const truncated = entry.body.length > 120 ? entry.body.slice(0, 120) + '…' : entry.body
  const hasImages = entry.image_paths.length > 0

  return (
    <div
      className={`rounded border px-3 py-2 min-w-[180px] max-w-[280px] ${def.cardBgClass || 'bg-gray-800/80'} ${def.cardBorderClass || 'border-gray-600'} ${selected ? 'ring-2 ring-blue-500' : ''}`}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#4b5563' }} />
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${def.tagBgClass} ${def.tagTextClass}`}>
          {def.label}
        </span>
        {hasImages && (
          <span className="text-xs text-gray-500">📷 {entry.image_paths.length}</span>
        )}
      </div>
      <p className="text-xs text-gray-200 leading-relaxed whitespace-pre-wrap break-words">{truncated}</p>
      <Handle type="source" position={Position.Bottom} style={{ background: '#4b5563' }} />
    </div>
  )
}

export default memo(EntryNode)
