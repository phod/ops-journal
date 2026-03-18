import { memo, useEffect, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { NodeShell } from './NodeShell'

export interface ImageNodeData {
  imagePath: string
}

function ImageNode({ id, data, selected }: NodeProps) {
  const { imagePath } = data as ImageNodeData
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!imagePath) return
    window.electronAPI.getEntryImage(imagePath).then(setSrc).catch(() => setSrc(null))
  }, [imagePath])

  return (
    <div className={`relative rounded border border-gray-600 overflow-hidden bg-gray-800 ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <NodeShell nodeId={id} selected={selected ?? false} minWidth={80}>
      {src ? (
        <img
          src={src}
          alt=""
          className="block w-full h-full object-contain"
          draggable={false}
          onContextMenu={(e) => { e.preventDefault(); window.electronAPI.showImageContextMenu(imagePath) }}
        />
      ) : (
        <div className="w-[180px] h-[120px] flex items-center justify-center text-xs text-gray-500">
          Loading…
        </div>
      )}
      </NodeShell>
    </div>
  )
}

export default memo(ImageNode)
