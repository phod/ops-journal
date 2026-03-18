import type { EntryType } from '@shared/ipc-types'
import { ENTRY_TYPES } from '@shared/entry-types'

interface Props {
  currentType: EntryType
  onSelect: (type: EntryType) => void
}

export function EntryTypeMenu({ currentType, onSelect }: Props) {
  return (
    <div className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden z-20 min-w-[120px] shadow-lg">
      {ENTRY_TYPES.map((def) => (
        <button
          key={def.type}
          onMouseDown={(e) => { e.preventDefault(); onSelect(def.type) }}
          className={`no-drag w-full text-left px-3 py-1.5 text-xs font-mono flex items-center gap-2 transition-colors hover:bg-gray-700 ${
            currentType === def.type ? 'text-gray-100' : 'text-gray-400'
          }`}
        >
          <span className={`px-1.5 py-0.5 rounded text-xs ${def.tagBgClass} ${def.tagTextClass}`}>
            {def.label.toUpperCase()}
          </span>
          {currentType === def.type && <span className="ml-auto text-gray-500">✓</span>}
        </button>
      ))}
    </div>
  )
}
