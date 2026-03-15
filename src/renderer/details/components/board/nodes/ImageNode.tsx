import { memo, useEffect, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

export interface ImageNodeData {
  imagePath: string
}

function ImageNode({ data, selected }: NodeProps) {
  const { imagePath } = data as ImageNodeData
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!imagePath) return
    window.electronAPI.getEntryImage(imagePath).then(setSrc).catch(() => setSrc(null))
  }, [imagePath])

  return (
    <div className={`rounded border border-gray-600 overflow-hidden bg-gray-800 ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <Handle type="target" position={Position.Top} style={{ background: '#4b5563' }} />
      {src ? (
        <img
          src={src}
          alt=""
          className="block max-w-[280px] max-h-[200px] object-contain"
          draggable={false}
        />
      ) : (
        <div className="w-[180px] h-[120px] flex items-center justify-center text-xs text-gray-500">
          Loading…
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#4b5563' }} />
    </div>
  )
}

export default memo(ImageNode)
