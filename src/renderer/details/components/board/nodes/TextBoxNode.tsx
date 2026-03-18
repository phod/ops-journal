import { memo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { NodeShell } from './NodeShell'

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
      className={`relative rounded border bg-gray-800/90 border-gray-600 ${selected ? 'ring-2 ring-blue-500' : ''}`}
    >
      <NodeShell nodeId={id} selected={selected ?? false} minHeight={50}>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder="Type here…"
        className="block w-full h-full bg-transparent text-xs text-gray-200 p-2.5 resize-none focus:outline-none placeholder-gray-600 min-h-[60px]"
        rows={3}
      />
      </NodeShell>
    </div>
  )
}

export default memo(TextBoxNode)
