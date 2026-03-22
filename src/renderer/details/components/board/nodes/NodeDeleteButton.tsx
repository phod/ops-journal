import { useReactFlow } from '@xyflow/react'

interface Props {
  nodeId: string
}

export function NodeDeleteButton({ nodeId }: Props) {
  const { deleteElements } = useReactFlow()

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        deleteElements({ nodes: [{ id: nodeId }] })
      }}
      className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs flex items-center justify-center shadow-md transition-colors z-10"
      data-tooltip="Delete node"
    >
      ✕
    </button>
  )
}
