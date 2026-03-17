import { Node, mergeAttributes, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useEffect, useState, useRef, useCallback } from 'react'

function SummaryImageNodeView({ node, updateAttributes, editor }: NodeViewProps) {
  const { src, width } = node.attrs
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [resizing, setResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)
  const isEditable = editor.isEditable

  useEffect(() => {
    if (!src) return
    window.electronAPI.getEntryImage(src).then(setDataUrl)
  }, [src])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setResizing(true)
    startXRef.current = e.clientX
    startWidthRef.current = containerRef.current?.offsetWidth ?? 300
  }, [])

  useEffect(() => {
    if (!resizing) return

    function onMouseMove(e: MouseEvent) {
      const delta = e.clientX - startXRef.current
      const newWidth = Math.max(80, startWidthRef.current + delta)
      const parent = containerRef.current?.parentElement
      const maxWidth = parent ? parent.offsetWidth : 9999
      updateAttributes({ width: Math.min(newWidth, maxWidth) })
    }

    function onMouseUp() {
      setResizing(false)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [resizing, updateAttributes])

  if (!dataUrl) {
    return (
      <NodeViewWrapper>
        <div className="my-2 h-20 bg-gray-800 rounded border border-gray-700 flex items-center justify-center text-gray-600 text-xs font-mono">
          Loading…
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper>
      <div
        ref={containerRef}
        className="my-2 relative group inline-block"
        style={{ width: width ? `${width}px` : undefined, maxWidth: '100%' }}
      >
        <img
          src={dataUrl}
          alt=""
          className="rounded border border-gray-700 w-full"
          draggable={false}
          onContextMenu={(e) => { e.preventDefault(); window.electronAPI.showImageContextMenu(src) }}
        />
        {isEditable && (
          <div
            onMouseDown={onMouseDown}
            className="absolute top-0 right-0 w-2 h-full cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity bg-blue-500/40 rounded-r"
            title="Drag to resize"
          />
        )}
      </div>
    </NodeViewWrapper>
  )
}

export const SummaryImageNode = Node.create({
  name: 'summaryImage',
  atom: true,
  group: 'block',

  addAttributes() {
    return {
      src: { default: null },
      width: { default: null }
    }
  },

  parseHTML() {
    return [{ tag: 'img[data-summary-image]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes, { 'data-summary-image': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(SummaryImageNodeView)
  }
})
