import { Node, mergeAttributes, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useEffect, useState } from 'react'

function SummaryImageNodeView({ node }: NodeViewProps) {
  const { src } = node.attrs
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!src) return
    window.electronAPI.getEntryImage(src).then(setDataUrl)
  }, [src])

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
      <div className="my-2">
        <img
          src={dataUrl}
          alt=""
          className={`rounded border border-gray-700 cursor-pointer transition-all ${expanded ? 'max-w-full' : 'max-h-48 max-w-full'}`}
          onClick={() => setExpanded((e) => !e)}
          title={expanded ? 'Click to collapse' : 'Click to expand'}
        />
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
      src: { default: null }
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
