import { useState } from 'react'
import { filterEntries, getEntryTypeDefinition } from '@shared/entry-types'
import type { Filter } from '@shared/entry-types'
import type { JournalEntry } from '@shared/ipc-types'
import type { ShapeKind } from '@shared/board-types'

interface Props {
  entries: JournalEntry[]
  onAddTextBox: () => void
  onAddImage: (imagePath: string) => void
  onAddShape: (shape: ShapeKind) => void
}

const FILTER_TABS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'finding', label: 'Findings' },
  { key: 'action', label: 'Actions' },
  { key: 'hypothesis', label: 'Hypotheses' },
  { key: 'images', label: 'Images' }
]

const SHAPES: { kind: ShapeKind; label: string; icon: string }[] = [
  { kind: 'square', label: 'Square', icon: '◻' },
  { kind: 'circle', label: 'Circle', icon: '○' },
  { kind: 'cloud', label: 'Cloud', icon: '☁' }
]

export function BoardSidebar({ entries, onAddTextBox, onAddImage, onAddShape }: Props) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = filterEntries(entries, filter)

  async function handleUploadImage() {
    const dataUrls = await window.electronAPI.pickImage()
    if (!dataUrls.length) return
    // Save each image and add as node
    for (const dataUrl of dataUrls) {
      const imagePath = await window.electronAPI.saveBoardImage(dataUrl)
      onAddImage(imagePath)
    }
  }

  async function handleScreenshot() {
    const dataUrl = await window.electronAPI.captureScreenshot()
    if (!dataUrl) return
    const imagePath = await window.electronAPI.saveBoardImage(dataUrl)
    onAddImage(imagePath)
  }

  return (
    <div className="w-64 flex-shrink-0 border-l border-gray-700/50 flex flex-col bg-gray-900/50">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1 px-2 pt-2 pb-1 border-b border-gray-700/50 flex-shrink-0">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              filter === key
                ? 'bg-gray-700 text-gray-100'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Entries list */}
      <div className="flex-1 overflow-y-auto py-1.5 px-2">
        {filtered.length === 0 ? (
          <div className="text-xs text-gray-600 text-center py-4">No entries</div>
        ) : (
          <div className="flex flex-col gap-1">
            {filtered.map((entry) => (
              <DraggableEntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex-shrink-0 border-t border-gray-700/50 p-2 flex flex-col gap-1.5">
        <button
          onClick={onAddTextBox}
          className="w-full text-xs px-3 py-1.5 rounded border border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-400 transition-colors"
        >
          + Text Box
        </button>
        <div className="flex gap-1">
          {SHAPES.map(({ kind, label, icon }) => (
            <button
              key={kind}
              onClick={() => onAddShape(kind)}
              title={label}
              className="flex-1 text-sm py-1.5 rounded border border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-400 transition-colors"
            >
              {icon}
            </button>
          ))}
        </div>
        <button
          onClick={handleUploadImage}
          className="w-full text-xs px-3 py-1.5 rounded border border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-400 transition-colors"
        >
          + Upload Image
        </button>
        <button
          onClick={handleScreenshot}
          className="w-full text-xs px-3 py-1.5 rounded border border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-400 transition-colors"
        >
          + Screenshot
        </button>
      </div>
    </div>
  )
}

function DraggableEntryCard({ entry }: { entry: JournalEntry }) {
  const def = getEntryTypeDefinition(entry.type)
  const truncated = entry.body.length > 80 ? entry.body.slice(0, 80) + '…' : entry.body

  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('application/x-board-entry', entry.id)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`rounded border px-2 py-1.5 cursor-grab active:cursor-grabbing ${def.cardBgClass || 'bg-gray-800/60'} ${def.cardBorderClass || 'border-gray-600/50'}`}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <span className={`text-xs px-1 py-0.5 rounded font-medium ${def.tagBgClass} ${def.tagTextClass}`}>
          {def.label}
        </span>
        {entry.flagged && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
            <line x1="4" y1="22" x2="4" y2="15"/>
          </svg>
        )}
        {entry.image_paths.length > 0 && (
          <span className="text-xs text-gray-600">📷</span>
        )}
      </div>
      <p className="text-xs text-gray-400 leading-relaxed break-words">{truncated}</p>
    </div>
  )
}
