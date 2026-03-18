import type { EntryTypeDefinition } from '@shared/entry-types'

interface Props {
  completions: EntryTypeDefinition[]
  selectedIndex: number
  onSelect: (def: EntryTypeDefinition) => void
}

export function AutocompleteDropdown({ completions, selectedIndex, onSelect }: Props) {
  if (completions.length === 0) return null

  return (
    <div className="absolute bottom-full mb-1 left-0 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden z-10 min-w-[160px]">
      {completions.map((def, i) => (
        <button
          key={def.type}
          onMouseDown={(e) => { e.preventDefault(); onSelect(def) }}
          className={`w-full text-left px-3 py-1.5 text-sm font-mono flex items-center gap-2 transition-colors ${
            i === selectedIndex ? 'bg-gray-700 text-gray-100' : 'text-gray-300 hover:bg-gray-700/60'
          }`}
        >
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${def.tagBgClass} ${def.tagTextClass}`}>
            {def.label.toUpperCase()}
          </span>
          <span className="text-gray-500">{def.command}</span>
        </button>
      ))}
    </div>
  )
}
