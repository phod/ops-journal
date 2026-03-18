import type { HypothesisStatus } from '@shared/ipc-types'
import { HYPOTHESIS_STATUS_LABEL, HYPOTHESIS_STATUS_CLASS } from '@shared/entry-types'

interface Props {
  currentStatus: HypothesisStatus
  onSelect: (status: HypothesisStatus) => void
}

export function HypothesisStatusMenu({ currentStatus, onSelect }: Props) {
  return (
    <div className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden z-20 min-w-[110px] shadow-lg">
      {(Object.keys(HYPOTHESIS_STATUS_LABEL) as HypothesisStatus[]).map((s) => (
        <button
          key={s}
          onMouseDown={(e) => { e.preventDefault(); onSelect(s) }}
          className={`no-drag w-full text-left px-3 py-1.5 text-xs font-mono flex items-center gap-2 transition-colors hover:bg-gray-700 ${
            currentStatus === s ? 'text-gray-100' : 'text-gray-400'
          }`}
        >
          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${HYPOTHESIS_STATUS_CLASS[s]}`}>
            {HYPOTHESIS_STATUS_LABEL[s]}
          </span>
          {currentStatus === s && <span className="ml-auto text-gray-500">✓</span>}
        </button>
      ))}
    </div>
  )
}
