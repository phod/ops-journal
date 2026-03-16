import { memo, useCallback } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { NodeDeleteButton } from './NodeDeleteButton'

export interface TextBoxNodeData {
  text: string
  onChange?: (text: string) => void
}

function TextBoxNode({ id, data, selected }: NodeProps) {
  const { text, onChange } = data as TextBoxNodeData

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e.target.value)
    },
    [onChange]
  )

  return (
    <div
      className={`relative rounded border bg-gray-800/90 border-gray-600 min-w-[160px] ${selected ? 'ring-2 ring-blue-500' : ''}`}
    >
      {selected && <NodeDeleteButton nodeId={id} />}
      <Handle type="target" position={Position.Top} style={{ background: '#4b5563' }} />
      <Handle type="target" position={Position.Left} id="left-target" style={{ background: '#4b5563' }} />
      <textarea
        value={text}
        onChange={handleChange}
        placeholder="Type here…"
        className="block w-full bg-transparent text-xs text-gray-200 p-2.5 resize-none focus:outline-none placeholder-gray-600 min-h-[60px]"
        rows={3}
        style={{ minWidth: 160 }}
      />
      <Handle type="source" position={Position.Bottom} style={{ background: '#4b5563' }} />
      <Handle type="source" position={Position.Right} id="right-source" style={{ background: '#4b5563' }} />
    </div>
  )
}

export default memo(TextBoxNode)
