import { memo, useCallback } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { NodeDeleteButton } from './NodeDeleteButton'
import type { ShapeKind } from '@shared/board-types'

export interface ShapeNodeData {
  shape: ShapeKind
  label: string
  onChange?: (label: string) => void
}

const CLOUD_PATH =
  'M 25,60 C 10,60 0,50 5,40 C 0,30 10,20 25,25 C 30,10 50,5 65,15 C 75,5 95,10 95,25 C 105,30 105,45 95,50 C 100,60 85,65 75,60 Z'

function ShapeNode({ id, data, selected }: NodeProps) {
  const { shape, label, onChange } = data as ShapeNodeData

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e.target.value)
    },
    [onChange]
  )

  const handleStyle = { background: '#4b5563' }

  const shapeContent = (
    <input
      value={label}
      onChange={handleChange}
      placeholder="Type here…"
      className="bg-transparent text-xs text-gray-200 text-center w-full focus:outline-none placeholder-gray-600"
    />
  )

  return (
    <div className="relative">
      {selected && <NodeDeleteButton nodeId={id} />}
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="target" position={Position.Left} id="left-target" style={handleStyle} />

      {shape === 'rectangle' && (
        <div className={`flex items-center justify-center px-4 py-3 min-w-[140px] min-h-[60px] rounded border bg-gray-800/90 ${selected ? 'ring-2 ring-blue-500 border-gray-500' : 'border-gray-500'}`}>
          {shapeContent}
        </div>
      )}

      {shape === 'square' && (
        <div className={`flex items-center justify-center p-4 w-[100px] h-[100px] rounded border bg-gray-800/90 ${selected ? 'ring-2 ring-blue-500 border-gray-500' : 'border-gray-500'}`}>
          {shapeContent}
        </div>
      )}

      {shape === 'circle' && (
        <div className={`flex items-center justify-center p-4 w-[100px] h-[100px] rounded-full border bg-gray-800/90 ${selected ? 'ring-2 ring-blue-500 border-gray-500' : 'border-gray-500'}`}>
          {shapeContent}
        </div>
      )}

      {shape === 'oval' && (
        <div className={`flex items-center justify-center px-6 py-3 min-w-[140px] min-h-[70px] rounded-[50%] border bg-gray-800/90 ${selected ? 'ring-2 ring-blue-500 border-gray-500' : 'border-gray-500'}`}>
          {shapeContent}
        </div>
      )}

      {shape === 'cloud' && (
        <div className="relative flex items-center justify-center" style={{ width: 110, height: 70 }}>
          <svg viewBox="0 0 110 70" className="absolute inset-0 w-full h-full">
            {selected && (
              <path
                d={CLOUD_PATH}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="4"
              />
            )}
            <path
              d={CLOUD_PATH}
              fill="rgba(31,41,55,0.9)"
              stroke="#6b7280"
              strokeWidth="1"
            />
          </svg>
          <div className="relative z-10 px-4">{shapeContent}</div>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="source" position={Position.Right} id="right-source" style={handleStyle} />
    </div>
  )
}

export default memo(ShapeNode)
