import { Handle, Position, NodeResizer } from '@xyflow/react'
import { NodeDeleteButton } from './NodeDeleteButton'

const HANDLE_STYLE = { background: '#4b5563' }
const RESIZER_LINE_STYLE = { borderColor: '#3b82f6' }
const RESIZER_HANDLE_STYLE = { background: '#3b82f6', width: 8, height: 8, borderRadius: 2 }

interface NodeShellProps {
  nodeId: string
  selected: boolean
  minWidth?: number
  minHeight?: number
  children: React.ReactNode
}

export function NodeShell({ nodeId, selected, minWidth = 120, minHeight = 60, children }: NodeShellProps) {
  return (
    <>
      {selected && <NodeResizer
        minWidth={minWidth}
        minHeight={minHeight}
        lineStyle={RESIZER_LINE_STYLE}
        handleStyle={RESIZER_HANDLE_STYLE}
      />}
      {selected && <NodeDeleteButton nodeId={nodeId} />}
      <Handle type="target" position={Position.Top} id="top-target" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Top} id="top-source" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Left} id="left-target" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Left} id="left-source" style={HANDLE_STYLE} />
      {children}
      <Handle type="target" position={Position.Bottom} id="bottom-target" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Right} id="right-target" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right} id="right-source" style={HANDLE_STYLE} />
    </>
  )
}
