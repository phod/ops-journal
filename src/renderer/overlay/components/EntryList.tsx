import React, { useEffect, useRef, useState } from 'react'
import type { JournalEntry } from '../../../../shared/ipc-types'

interface Props {
  entries: JournalEntry[]
  onEntryUpdated: (entry: JournalEntry) => void
  onEntryDeleted: (id: string) => void
}

function formatTimestamp(isoString: string): string {
  try {
    const normalized = isoString.endsWith('Z') ? isoString : isoString + 'Z'
    const date = new Date(normalized)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSecs < 60) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  } catch {
    return isoString
  }
}

interface EntryRowProps {
  entry: JournalEntry
  onUpdated: (entry: JournalEntry) => void
  onDeleted: (id: string) => void
}

function EntryRow({ entry, onUpdated, onDeleted }: EntryRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.body)
  const [saving, setSaving] = useState(false)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [imageExpanded, setImageExpanded] = useState(false)
  const [removeImage, setRemoveImage] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (entry.image_path) {
      window.electronAPI.getEntryImage(entry.image_path).then(setImageDataUrl).catch(() => {})
    } else {
      setImageDataUrl(null)
    }
  }, [entry.image_path])

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus()
      const len = textareaRef.current?.value.length ?? 0
      textareaRef.current?.setSelectionRange(len, len)
    }
  }, [editing])

  const startEdit = () => {
    setDraft(entry.body)
    setRemoveImage(false)
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setDraft(entry.body)
    setRemoveImage(false)
  }

  const saveEdit = async () => {
    const trimmed = draft.trim()
    if (!trimmed && !imageDataUrl && !removeImage) {
      cancelEdit()
      return
    }
    if (trimmed === entry.body && !removeImage) {
      cancelEdit()
      return
    }
    setSaving(true)
    try {
      // imageDataUrl param: null = remove, undefined = keep existing
      const imageParam = removeImage ? null : undefined
      const updated = await window.electronAPI.updateEntry(entry.id, trimmed, imageParam)
      onUpdated(updated)
      setEditing(false)
      setRemoveImage(false)
    } catch (err) {
      console.error('[overlay] Failed to update entry:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      saveEdit()
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      cancelEdit()
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this entry? This cannot be undone.')) return
    try {
      await window.electronAPI.deleteEntry(entry.id)
      onDeleted(entry.id)
    } catch (err) {
      console.error('[overlay] Failed to delete entry:', err)
    }
  }

  return (
    <div className="group bg-gray-800/60 rounded-lg px-3 py-2 border border-gray-700/50">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-gray-500 font-mono select-none">
          {formatTimestamp(entry.created_at)}
        </div>
        {!editing && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={startEdit}
              className="no-drag text-gray-500 hover:text-gray-300 transition-colors px-1"
              title="Edit"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              onClick={handleDelete}
              className="no-drag text-gray-500 hover:text-red-400 transition-colors px-1"
              title="Delete"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={saving}
            rows={3}
            className="no-drag w-full bg-gray-700/80 text-gray-100 font-mono text-sm rounded px-2 py-1.5 border border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
          />
          {imageDataUrl && !removeImage && (
            <div className="mt-1.5 flex items-center gap-2">
              <img src={imageDataUrl} alt="Attached" className="max-h-20 rounded border border-gray-600 object-contain" />
              <button
                onClick={() => setRemoveImage(true)}
                className="no-drag text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Remove image
              </button>
            </div>
          )}
          {removeImage && (
            <div className="mt-1 text-xs text-gray-500">Image will be removed on save.</div>
          )}
          <div className="flex gap-2 mt-1.5">
            <button
              onClick={saveEdit}
              disabled={saving}
              className="no-drag text-xs px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={cancelEdit}
              className="no-drag text-xs px-2 py-0.5 text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {entry.body && (
            <div
              onDoubleClick={startEdit}
              className="text-gray-100 text-sm font-mono whitespace-pre-wrap break-words leading-relaxed cursor-text"
            >
              {entry.body}
            </div>
          )}
          {imageDataUrl && (
            <div className={entry.body ? 'mt-1.5' : ''}>
              <img
                src={imageDataUrl}
                alt="Attached"
                onClick={() => setImageExpanded((v) => !v)}
                className={`rounded border border-gray-600 object-contain cursor-pointer transition-all ${
                  imageExpanded ? 'max-h-none w-full' : 'max-h-48'
                }`}
                title={imageExpanded ? 'Click to collapse' : 'Click to expand'}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function EntryList({ entries, onEntryUpdated, onEntryDeleted }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries])

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm font-mono">
        No entries yet. Start typing below.
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
      {entries.map((entry) => (
        <EntryRow
          key={entry.id}
          entry={entry}
          onUpdated={onEntryUpdated}
          onDeleted={onEntryDeleted}
        />
      ))}
    </div>
  )
}
