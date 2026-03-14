import { Node, mergeAttributes, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useEffect, useState } from 'react'
import { getEntryTypeDefinition } from '@shared/entry-types'
import { formatDate } from '@shared/format-date'

const TIMESTAMP_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
}

function EntryRefNodeView({ node }: NodeViewProps) {
  const { entryType, entryBody, entryTimestamp, entryImagePaths } = node.attrs
  const typeDef = getEntryTypeDefinition(entryType ?? 'note')
  const isTyped = entryType !== 'note'
  const imagePaths: string[] = Array.isArray(entryImagePaths) ? entryImagePaths : []
  const [dataUrls, setDataUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    for (const p of imagePaths) {
      window.electronAPI.getEntryImage(p).then((url) => {
        setDataUrls((prev) => ({ ...prev, [p]: url }))
      })
    }
  }, [imagePaths.join(',')])

  return (
    <NodeViewWrapper>
      <div
        className={`my-2 px-3 py-2 rounded-lg border text-sm font-mono select-none ${
          isTyped
            ? `border-l-4 ${typeDef.leftBorderClass} ${typeDef.cardBgClass} ${typeDef.cardBorderClass}`
            : 'bg-gray-800/60 border-gray-700/50'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          {isTyped && (
            <span className={`px-1.5 py-0.5 rounded text-xs ${typeDef.tagBgClass} ${typeDef.tagTextClass}`}>
              {typeDef.label.toUpperCase()}
            </span>
          )}
          <span className="text-gray-500 text-xs">
            {entryTimestamp ? formatDate(entryTimestamp, TIMESTAMP_OPTIONS) : ''}
          </span>
        </div>
        {entryBody && (
          <div className="text-gray-200 text-xs line-clamp-3 whitespace-pre-wrap break-words leading-relaxed">
            {entryBody}
          </div>
        )}
        {!entryBody && imagePaths.length === 0 && (
          <div className="text-gray-500 text-xs italic">(no text)</div>
        )}
        {imagePaths.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {imagePaths.map((p) => (
              dataUrls[p]
                ? <img key={p} src={dataUrls[p]} alt="" className="h-16 w-16 object-cover rounded border border-gray-700" />
                : <div key={p} className="h-16 w-16 rounded border border-gray-700 bg-gray-800" />
            ))}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export const EntryRefNode = Node.create({
  name: 'entryRef',
  atom: true,
  group: 'block',

  addAttributes() {
    return {
      entryId: { default: null },
      entryType: { default: 'note' },
      entryBody: { default: '' },
      entryTimestamp: { default: '' },
      entryImagePaths: { default: [] }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-entry-ref]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-entry-ref': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(EntryRefNodeView)
  }
})
