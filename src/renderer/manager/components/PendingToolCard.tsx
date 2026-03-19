import { useState } from 'react'
import type { PendingToolEntry, ToolType } from '@shared/ipc-types'
import { ConfirmDialog } from './ConfirmDialog'

function looksLikeUrl(text: string): boolean {
  return /^https?:\/\//i.test(text.trim())
}

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface Props {
  entry: PendingToolEntry
  isExpanded: boolean
  onToggle: () => void
  onCreated: () => void
  onSkip: () => void
  onAbandoned: () => void
}

export function PendingToolCard({ entry, isExpanded, onToggle, onCreated, onSkip, onAbandoned }: Props) {
  const isUrl = looksLikeUrl(entry.body)
  const [toolType, setToolType] = useState<ToolType>(isUrl ? 'link' : 'string')
  const [name, setName] = useState('')
  const [value, setValue] = useState(entry.body)
  const [tagsInput, setTagsInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [abandoning, setAbandoning] = useState(false)
  const [confirmingAbandon, setConfirmingAbandon] = useState(false)

  const autoDetected = (isUrl && toolType === 'link') || (!isUrl && toolType === 'string')

  async function handleCreate() {
    if (!name.trim() || !value.trim()) return
    setSaving(true)
    try {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
      await window.electronAPI.createToolFromEntry(entry.id, name.trim(), toolType, value.trim(), tags)
      onCreated()
    } finally {
      setSaving(false)
    }
  }

  async function handleAbandon() {
    setAbandoning(true)
    try {
      await window.electronAPI.abandonToolEntry(entry.id)
      onAbandoned()
    } finally {
      setAbandoning(false)
    }
  }

  return (
    <>
    <div className={`rounded-xl border transition-all duration-200 ${
      isExpanded
        ? 'border-gray-700 bg-gray-900 shadow-[0_0_0_1px_rgba(99,102,241,0.25),0_4px_24px_-4px_rgba(99,102,241,0.08)]'
        : 'border-gray-800 bg-gray-900/60 hover:border-gray-700'
    }`}>
      {/* Header */}
      <button onClick={onToggle} className="w-full text-left px-4 py-3 flex items-start gap-3 group">
        <span className="mt-0.5 text-sky-400/70 text-xs flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M6.955 1.45A.5.5 0 0 1 7.452 1h1.096a.5.5 0 0 1 .497.45l.17 1.699c.484.12.94.312 1.356.562l1.321-.916a.5.5 0 0 1 .67.033l.774.775a.5.5 0 0 1 .034.67l-.916 1.32c.25.417.443.873.563 1.357l1.699.17a.5.5 0 0 1 .45.497v1.096a.5.5 0 0 1-.45.497l-1.699.17c-.12.484-.312.94-.562 1.356l.916 1.321a.5.5 0 0 1-.034.67l-.774.774a.5.5 0 0 1-.67.033l-1.32-.916c-.417.25-.874.443-1.357.563l-.17 1.699a.5.5 0 0 1-.497.45H7.452a.5.5 0 0 1-.497-.45l-.17-1.699a4.973 4.973 0 0 1-1.356-.562l-1.321.916a.5.5 0 0 1-.67-.034l-.774-.774a.5.5 0 0 1-.034-.67l.916-1.32a4.971 4.971 0 0 1-.563-1.357l-1.699-.17A.5.5 0 0 1 1 8.548V7.452a.5.5 0 0 1 .45-.497l1.699-.17c.12-.484.312-.94.562-1.356l-.916-1.321a.5.5 0 0 1 .034-.67l.774-.774a.5.5 0 0 1 .67-.033l1.32.916c.417-.25.874-.443 1.357-.563l.17-1.699ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" clipRule="evenodd" />
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm text-gray-200 truncate leading-tight">{entry.body}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-gray-500">{entry.investigation_name}</span>
            <span className="text-[11px] text-gray-700">&middot;</span>
            <span className="text-[11px] text-gray-600">{timeAgo(entry.created_at)}</span>
            {isUrl && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400/70 font-medium">URL detected</span>
            )}
          </div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
          className={`w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-all duration-200 flex-shrink-0 mt-1 ${isExpanded ? 'rotate-180' : ''}`}>
          <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Expandable form */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-800/60 space-y-3">
          {/* Type toggle */}
          <div>
            <label className="block text-[11px] text-gray-500 font-medium mb-1.5 uppercase tracking-wider">Type</label>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5 p-0.5 bg-gray-800 rounded-lg">
                {(['link', 'string'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setToolType(t)}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                      toolType === t
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {t === 'link' ? '↗ Link' : '⌨ String'}
                  </button>
                ))}
              </div>
              {autoDetected
                ? <span className="text-[10px] text-gray-600 font-medium">auto-detected</span>
                : <span className="text-[10px] text-amber-500/70 font-medium">overridden</span>
              }
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-[11px] text-gray-500 font-medium mb-1.5 uppercase tracking-wider">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Give this tool a name..."
              className="w-full bg-gray-800 border border-gray-700/80 rounded-lg px-3 py-2 text-sm text-gray-100
                placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors"
              autoFocus
            />
          </div>

          {/* Value */}
          <div>
            <label className="block text-[11px] text-gray-500 font-medium mb-1.5 uppercase tracking-wider">
              {toolType === 'link' ? 'URL' : 'Value'}
            </label>
            {toolType === 'link' ? (
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700/80 rounded-lg px-3 py-2 text-sm text-gray-100
                  font-mono placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors"
              />
            ) : (
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                rows={2}
                className="w-full bg-gray-800 border border-gray-700/80 rounded-lg px-3 py-2 text-sm text-gray-100
                  font-mono placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors resize-none"
              />
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[11px] text-gray-500 font-medium mb-1.5 uppercase tracking-wider">
              Tags <span className="text-gray-700 normal-case tracking-normal">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. monitoring, production"
              className="w-full bg-gray-800 border border-gray-700/80 rounded-lg px-3 py-2 text-sm text-gray-100
                placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onSkip}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-800 text-gray-400
                hover:text-gray-200 hover:bg-gray-700 transition-colors border border-gray-700/50"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => setConfirmingAbandon(true)}
              disabled={abandoning}
              className="px-3 py-1.5 text-xs font-medium rounded-lg text-red-400
                hover:bg-red-500/10 transition-colors disabled:opacity-40"
            >
              Abandon
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!name.trim() || !value.trim() || saving}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500
                text-white transition-colors shadow-sm shadow-indigo-500/10 disabled:opacity-40"
            >
              Create Tool
            </button>
          </div>
        </div>
      )}
    </div>

    {confirmingAbandon && (
      <ConfirmDialog
        title="Abandon Tool Entry"
        message="Are you sure you want to abandon this tool entry? It won't appear in the conversion queue unless manually set back to pending."
        confirmLabel="Abandon"
        onConfirm={() => { setConfirmingAbandon(false); handleAbandon() }}
        onCancel={() => setConfirmingAbandon(false)}
      />
    )}
    </>
  )
}
