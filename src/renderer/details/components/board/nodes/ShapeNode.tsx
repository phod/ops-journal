import { memo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { NodeShell } from './NodeShell'
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

  const shapeContent = (
    <input
      value={label}
      onChange={handleChange}
      placeholder="Type here…"
      className="bg-transparent text-xs text-gray-200 text-center w-full focus:outline-none placeholder-gray-600"
    />
  )

  // Treat legacy rectangle as square, legacy oval as circle
  const effectiveShape = shape === 'rectangle' ? 'square' : shape === 'oval' ? 'circle' : shape

  return (
    <div className="relative w-full h-full">
      <NodeShell nodeId={id} selected={selected ?? false} minWidth={60} minHeight={60}>

      {effectiveShape === 'square' && (
        <div className={`flex items-center justify-center px-4 py-3 w-full h-full rounded border bg-gray-800/90 ${selected ? 'ring-2 ring-blue-500 border-gray-500' : 'border-gray-500'}`}>
          {shapeContent}
        </div>
      )}

      {effectiveShape === 'circle' && (
        <div className={`flex items-center justify-center p-4 w-full h-full rounded-full border bg-gray-800/90 ${selected ? 'ring-2 ring-blue-500 border-gray-500' : 'border-gray-500'}`}>
          {shapeContent}
        </div>
      )}

      {effectiveShape === 'cloud' && (
        <div className="relative flex items-center justify-center w-full h-full">
          <svg viewBox="0 0 110 70" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
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

      </NodeShell>
    </div>
  )
}

export default memo(ShapeNode)
