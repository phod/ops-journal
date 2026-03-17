import { memo, useEffect, useState } from 'react'
import { Handle, Position, NodeResizer } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { NodeDeleteButton } from './NodeDeleteButton'

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
      {selected && <NodeResizer
        minWidth={80}
        minHeight={60}
        lineStyle={{ borderColor: '#3b82f6' }}
        handleStyle={{ background: '#3b82f6', width: 8, height: 8, borderRadius: 2 }}
      />}
      {selected && <NodeDeleteButton nodeId={id} />}
      <Handle type="target" position={Position.Top} id="top-target" style={{ background: '#4b5563' }} />
      <Handle type="source" position={Position.Top} id="top-source" style={{ background: '#4b5563' }} />
      <Handle type="target" position={Position.Left} id="left-target" style={{ background: '#4b5563' }} />
      <Handle type="source" position={Position.Left} id="left-source" style={{ background: '#4b5563' }} />
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
      <Handle type="target" position={Position.Bottom} id="bottom-target" style={{ background: '#4b5563' }} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" style={{ background: '#4b5563' }} />
      <Handle type="target" position={Position.Right} id="right-target" style={{ background: '#4b5563' }} />
      <Handle type="source" position={Position.Right} id="right-source" style={{ background: '#4b5563' }} />
    </div>
  )
}

export default memo(ImageNode)
