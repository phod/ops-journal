import { Node, mergeAttributes, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useState } from 'react'
import { getEntryTypeDefinition, HYPOTHESIS_STATUS_LABEL, HYPOTHESIS_STATUS_CLASS, HYPOTHESIS_STATUS_TEXT_CLASS } from '@shared/entry-types'
import type { HypothesisStatus } from '@shared/ipc-types'
import { formatDate, TIMESTAMP_OPTIONS_SHORT } from '@shared/format-date'
import { useEntryImages } from '@shared/useEntryImages'
import { FlagIcon } from '@shared/FlagIcon'

interface LinkedEntry {
  id: string
  body: string
}

interface LinkedHypothesis {
  id: string
  body: string
  status: string
  findings?: LinkedEntry[]
  actions?: LinkedEntry[]
  children?: LinkedHypothesis[]
}

function ChildHypothesisTree({ hypothesis, depth = 0 }: { hypothesis: LinkedHypothesis; depth?: number }) {
  const status = (hypothesis.status ?? 'open') as HypothesisStatus
  const findings = hypothesis.findings ?? []
  const actions = hypothesis.actions ?? []
  const children = hypothesis.children ?? []

  return (
    <div
      className="mt-1.5 px-2.5 py-1.5 rounded-lg border border-violet-500/25 bg-violet-500/5"
      style={{ marginLeft: depth > 0 ? 8 : 0 }}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <span className={`px-1 py-0.5 rounded text-xs font-semibold ${HYPOTHESIS_STATUS_CLASS[status]}`}>
          {HYPOTHESIS_STATUS_LABEL[status]}
        </span>
        <span className="text-xs text-violet-300">
          {hypothesis.body || <span className="italic text-gray-500">(no text)</span>}
        </span>
      </div>

      {/* Findings */}
      {findings.length > 0 && (
        <div className="mt-1.5">
          <div className="text-xs text-gray-600 font-mono uppercase tracking-wider mb-0.5">Findings</div>
          <div className="space-y-0.5">
            {findings.map((f) => (
              <div
                key={f.id}
                className="px-2 py-0.5 rounded text-xs font-mono bg-teal-500/10 border border-teal-500/25 text-teal-300"
              >
                {f.body || <span className="italic text-gray-500">(no text)</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {actions.length > 0 && (
        <div className="mt-1.5">
          <div className="text-xs text-gray-600 font-mono uppercase tracking-wider mb-0.5">Actions</div>
          <div className="space-y-0.5">
            {actions.map((a) => (
              <div
                key={a.id}
                className="px-2 py-0.5 rounded text-xs font-mono bg-orange-500/10 border border-orange-500/25 text-orange-300"
              >
                {a.body || <span className="italic text-gray-500">(no text)</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nested children */}
      {children.length > 0 && (
        <div className="mt-1.5">
          <div className="text-xs text-gray-600 font-mono uppercase tracking-wider mb-0.5">Child Hypotheses</div>
          {children.map((ch) => (
            <ChildHypothesisTree key={ch.id} hypothesis={ch} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function EntryRefNodeView({ node }: NodeViewProps) {
  const { entryType, entryBody, entryTimestamp, entryImagePaths, entryHypothesisStatus, entryLinkedFindings, entryLinkedActions, entryChildHypotheses, entryParentHypotheses, entryFlagged } = node.attrs
  const typeDef = getEntryTypeDefinition(entryType ?? 'note')
  const isTyped = entryType !== 'note'
  const isHypothesis = entryType === 'hypothesis'
  const imagePaths: string[] = Array.isArray(entryImagePaths) ? entryImagePaths : []
  const linkedFindings: LinkedEntry[] = Array.isArray(entryLinkedFindings) ? entryLinkedFindings : []
  const linkedActions: LinkedEntry[] = Array.isArray(entryLinkedActions) ? entryLinkedActions : []
  const childHypotheses: LinkedHypothesis[] = Array.isArray(entryChildHypotheses) ? entryChildHypotheses : []
  const parentHypotheses: LinkedHypothesis[] = Array.isArray(entryParentHypotheses) ? entryParentHypotheses : []
  const status = (entryHypothesisStatus ?? 'open') as HypothesisStatus
  const dataUrls = useEntryImages(imagePaths)
  const [expandedPath, setExpandedPath] = useState<string | null>(null)
  const [expandChildren, setExpandChildren] = useState(false)

  const hasNestedContent = childHypotheses.some(
    (ch) => (ch.findings && ch.findings.length > 0) || (ch.actions && ch.actions.length > 0) || (ch.children && ch.children.length > 0)
  )

  return (
    <NodeViewWrapper>
      <div
        className={`my-2 px-3 py-2 rounded-lg border text-sm font-mono select-none ${
          isTyped
            ? `border-l-4 ${typeDef.leftBorderClass} ${typeDef.cardBgClass} ${typeDef.cardBorderClass}`
            : 'bg-gray-800/60 border-gray-700/50'
        }`}
      >
        {/* Header row: type badge + timestamp + hypothesis status */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {isTyped && (
            <span className={`px-1.5 py-0.5 rounded text-xs ${typeDef.tagBgClass} ${typeDef.tagTextClass}`}>
              {typeDef.label.toUpperCase()}
            </span>
          )}
          {isHypothesis && entryHypothesisStatus && (
            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${HYPOTHESIS_STATUS_CLASS[status]}`}>
              {HYPOTHESIS_STATUS_LABEL[status]}
            </span>
          )}
          {entryFlagged && (
            <FlagIcon size={11} />
          )}
          <span className="text-gray-500 text-xs">
            {entryTimestamp ? formatDate(entryTimestamp, TIMESTAMP_OPTIONS_SHORT) : ''}
          </span>
        </div>

        {/* Body */}
        {entryBody && (
          <div className="text-gray-200 text-xs line-clamp-3 whitespace-pre-wrap break-words leading-relaxed">
            {entryBody}
          </div>
        )}
        {!entryBody && imagePaths.length === 0 && (
          <div className="text-gray-500 text-xs italic">(no text)</div>
        )}

        {/* Images */}
        {imagePaths.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {imagePaths.map((p) => (
              dataUrls[p]
                ? <img
                    key={p}
                    src={dataUrls[p]}
                    alt=""
                    onClick={() => setExpandedPath(expandedPath === p ? null : p)}
                    onContextMenu={(e) => { e.preventDefault(); window.electronAPI.showImageContextMenu(p) }}
                    className={`rounded border border-gray-700 object-contain cursor-pointer transition-all ${
                      expandedPath === p ? 'max-h-none w-full' : 'h-16 w-16 object-cover'
                    }`}
                    data-tooltip={expandedPath === p ? 'Click to collapse' : 'Click to expand'}
                  />
                : <div key={p} className="h-16 w-16 rounded border border-gray-700 bg-gray-800" />
            ))}
          </div>
        )}

        {/* Parent hypotheses */}
        {isHypothesis && parentHypotheses.length > 0 && (
          <div className="mt-2">
            <div className="text-xs text-gray-600 font-mono uppercase tracking-wider mb-1">Parent Hypothesis</div>
            <div className="flex flex-wrap gap-1.5">
              {parentHypotheses.map((p) => (
                <div
                  key={p.id}
                  className="px-2 py-0.5 rounded text-xs font-mono bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center gap-1.5"
                >
                  <span className={`font-semibold ${HYPOTHESIS_STATUS_TEXT_CLASS[(p.status ?? 'open') as HypothesisStatus]}`}>
                    {HYPOTHESIS_STATUS_LABEL[(p.status ?? 'open') as HypothesisStatus]}
                  </span>
                  <span>{p.body || <span className="italic text-gray-500">(no text)</span>}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Linked findings for hypothesis entries */}
        {isHypothesis && linkedFindings.length > 0 && (
          <div className="mt-2">
            <div className="text-xs text-gray-600 font-mono uppercase tracking-wider mb-1">Findings</div>
            <div className="space-y-1">
              {linkedFindings.map((f) => (
                <div
                  key={f.id}
                  className="px-2 py-1 rounded text-xs font-mono bg-teal-500/10 border border-teal-500/25 text-teal-300"
                >
                  {f.body || <span className="italic text-gray-500">(no text)</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Linked actions for hypothesis entries */}
        {isHypothesis && linkedActions.length > 0 && (
          <div className="mt-2">
            <div className="text-xs text-gray-600 font-mono uppercase tracking-wider mb-1">Actions</div>
            <div className="space-y-1">
              {linkedActions.map((a) => (
                <div
                  key={a.id}
                  className="px-2 py-1 rounded text-xs font-mono bg-orange-500/10 border border-orange-500/25 text-orange-300"
                >
                  {a.body || <span className="italic text-gray-500">(no text)</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Child hypotheses */}
        {isHypothesis && childHypotheses.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-xs text-gray-600 font-mono uppercase tracking-wider">Child Hypotheses</div>
              {hasNestedContent && (
                <button
                  onClick={() => setExpandChildren(!expandChildren)}
                  className="text-xs px-1.5 py-0.5 rounded border border-violet-500/30 text-violet-400 hover:bg-violet-500/15 hover:text-violet-300 transition-colors"
                >
                  {expandChildren ? '▾ Collapse' : '▸ Expand All'}
                </button>
              )}
            </div>
            {expandChildren ? (
              <div>
                {childHypotheses.map((ch) => (
                  <ChildHypothesisTree key={ch.id} hypothesis={ch} />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {childHypotheses.map((ch) => (
                  <div
                    key={ch.id}
                    className="px-2 py-0.5 rounded text-xs font-mono bg-violet-500/15 border border-violet-500/30 text-violet-300 flex items-center gap-1.5"
                  >
                    <span className={`font-semibold ${HYPOTHESIS_STATUS_TEXT_CLASS[(ch.status ?? 'open') as HypothesisStatus]}`}>
                      {HYPOTHESIS_STATUS_LABEL[(ch.status ?? 'open') as HypothesisStatus]}
                    </span>
                    <span>{ch.body || <span className="italic text-gray-500">(no text)</span>}</span>
                  </div>
                ))}
              </div>
            )}
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
      entryImagePaths: { default: [] },
      entryHypothesisStatus: { default: null },
      entryLinkedFindings: { default: [] },
      entryLinkedActions: { default: [] },
      entryChildHypotheses: { default: [] },
      entryParentHypotheses: { default: [] },
      entryFlagged: { default: false }
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
