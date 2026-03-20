import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { JournalEntry } from '@shared/ipc-types'
import {
  HYPOTHESIS_STATUS_LABEL,
  HYPOTHESIS_STATUS_CLASS
} from '@shared/entry-types'

interface RelationshipNodeData {
  entry: JournalEntry
  onFocus?: (id: string) => void
  dimmed?: boolean
  [key: string]: unknown
}

const TYPE_STYLES: Record<string, { width: number; borderColor: string; bg: string; label: string }> = {
  hypothesis: {
    width: 200,
    borderColor: '#8b5cf6',
    bg: 'rgba(139,92,246,0.08)',
    label: 'Hypothesis'
  },
  finding: {
    width: 170,
    borderColor: '#2dd4bf',
    bg: 'rgba(45,212,191,0.06)',
    label: 'Finding'
  },
  action: {
    width: 170,
    borderColor: '#fb923c',
    bg: 'rgba(251,146,60,0.06)',
    label: 'Action'
  }
}

function RelationshipNodeComponent({ data }: NodeProps): JSX.Element {
  const { entry, onFocus, dimmed } = data as RelationshipNodeData
  const style = TYPE_STYLES[entry.type] ?? TYPE_STYLES.finding

  return (
    <div
      onClick={() => onFocus?.(entry.id)}
      style={{
        width: style.width,
        borderLeft: `4px solid ${style.borderColor}`,
        background: style.bg,
        opacity: dimmed ? 0.15 : 1,
        transition: 'opacity 0.2s ease'
      }}
      className="rounded-md border border-gray-700/40 px-3 py-2.5 cursor-pointer hover:border-gray-500/60"
    >
      {/* Type label */}
      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: style.borderColor }}
        >
          {style.label}
        </span>
        {entry.type === 'hypothesis' && entry.hypothesis_status && (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${HYPOTHESIS_STATUS_CLASS[entry.hypothesis_status]}`}
          >
            {HYPOTHESIS_STATUS_LABEL[entry.hypothesis_status]}
          </span>
        )}
        {entry.type === 'action' && (
          <span className={`text-[10px] font-medium ${entry.action_completed ? 'text-green-400' : 'text-gray-500'}`}>
            {entry.action_completed ? '\u2713 Done' : '\u25CB Open'}
          </span>
        )}
      </div>

      {/* Body text (truncated to 2 lines) */}
      <p
        className="text-xs text-gray-300 leading-relaxed"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}
      >
        {entry.body}
      </p>

      {/* Handles */}
      <Handle type="target" position={Position.Left} id="left" className="!w-1.5 !h-1.5 !bg-gray-500 !border-0" />
      <Handle type="source" position={Position.Right} id="right" className="!w-1.5 !h-1.5 !bg-gray-500 !border-0" />
      <Handle type="target" position={Position.Top} id="top" className="!w-1.5 !h-1.5 !bg-gray-500 !border-0" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!w-1.5 !h-1.5 !bg-gray-500 !border-0" />
    </div>
  )
}

export const RelationshipNode = memo(RelationshipNodeComponent)
