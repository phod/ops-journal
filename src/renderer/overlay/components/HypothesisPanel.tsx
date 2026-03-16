import type { JournalEntry, HypothesisStatus } from '@shared/ipc-types'

interface Props {
  entries: JournalEntry[]
  onClose: () => void
}

const STATUS_LABEL: Record<HypothesisStatus, string> = {
  open: 'Open',
  true: 'True',
  false: 'False',
  abandoned: 'Abandoned'
}

const STATUS_CLASS: Record<HypothesisStatus, string> = {
  open: 'text-yellow-300',
  true: 'text-green-300',
  false: 'text-red-400',
  abandoned: 'text-gray-500'
}

export function HypothesisPanel({ entries, onClose }: Props) {
  const hypotheses = entries.filter((e) => e.type === 'hypothesis')

  const scrollToEntry = (id: string) => {
    const el = document.getElementById(`entry-${id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  return (
    <div className="w-44 border-l-2 border-violet-500/40 bg-violet-950/30 flex flex-col flex-shrink-0">
      <div className="flex items-center justify-between px-2 py-2 border-b border-violet-500/20">
        <span className="text-xs font-bold text-violet-300 uppercase tracking-wider">Hypotheses</span>
        <button
          onClick={onClose}
          className="no-drag text-gray-600 hover:text-gray-400 text-xs transition-colors"
          title="Close panel"
        >
          ✕
        </button>
      </div>
      {hypotheses.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-600 px-3 text-center font-mono leading-relaxed">
          No hypotheses yet.{'\n'}Use /hypothesis to add one.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1.5">
          {hypotheses.map((h) => {
            const status = h.hypothesis_status ?? 'open'
            const findingCount = h.linked_finding_ids?.length ?? 0
            const childCount = h.linked_child_hypothesis_ids?.length ?? 0
            return (
              <button
                key={h.id}
                onClick={() => scrollToEntry(h.id)}
                className="no-drag w-full text-left px-2 py-1.5 rounded bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/25 transition-colors"
              >
                <div className="flex items-center gap-1 mb-0.5">
                  <span className={`text-xs font-semibold ${STATUS_CLASS[status]}`}>
                    {STATUS_LABEL[status]}
                  </span>
                  {findingCount > 0 && (
                    <span className="text-xs text-gray-600">· {findingCount}f</span>
                  )}
                  {childCount > 0 && (
                    <span className="text-xs text-gray-600">· {childCount}h</span>
                  )}
                </div>
                <div className="text-xs text-gray-300 line-clamp-2 font-mono leading-tight">
                  {h.body || '(no text)'}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
