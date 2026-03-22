import { useState, useEffect } from 'react'
import type { PendingToolEntry, ToolType, ToolFolder, FunctionParameter, FunctionParameterType } from '@shared/ipc-types'
import { TOOL_ENTRY_STATUS_CLASS } from '@shared/entry-types'
import { ConfirmDialog } from './ConfirmDialog'
import { FolderTreePicker } from './FolderTreePicker'

const PARAM_TYPE_LABELS: Record<FunctionParameterType, string> = {
  'text': 'Free text',
  'list': 'List',
  'list-other': 'List + Other'
}

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

function parseReferenceFromBody(body: string): { key: string; value: string }[] {
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean)
  const entries: { key: string; value: string }[] = []
  for (const line of lines) {
    const colonMatch = line.match(/^([^:=]+):\s*(.*)$/)
    const equalsMatch = line.match(/^([^:=]+)=\s*(.*)$/)
    const match = colonMatch || equalsMatch
    if (match) {
      entries.push({ key: match[1].trim(), value: match[2].trim() })
    }
  }
  return entries.length > 0 ? entries : [{ key: '', value: '' }]
}

const TYPE_CONFIG: { type: ToolType; label: string; activeClass: string }[] = [
  { type: 'link', label: '↗ Link', activeClass: 'bg-indigo-600 text-white shadow-sm' },
  { type: 'string', label: '⌨ String', activeClass: 'bg-indigo-600 text-white shadow-sm' },
  { type: 'function', label: '⚡ Function', activeClass: 'bg-emerald-600 text-white shadow-sm' },
  { type: 'content', label: '📖 Content', activeClass: 'bg-purple-600 text-white shadow-sm' },
  { type: 'reference', label: '📋 Reference', activeClass: 'bg-cyan-600 text-white shadow-sm' },
]

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
  const isAbandoned = entry.tool_status === 'abandoned'
  const [toolType, setToolType] = useState<ToolType>(isUrl ? 'link' : 'string')
  const [name, setName] = useState('')
  const [value, setValue] = useState(entry.body)
  const [tagsInput, setTagsInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [abandoning, setAbandoning] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [confirmingAbandon, setConfirmingAbandon] = useState(false)
  const [sourceTextExpanded, setSourceTextExpanded] = useState(true)
  const [parameters, setParameters] = useState<FunctionParameter[]>([])
  const [optionsInputs, setOptionsInputs] = useState<Record<number, string>>({})
  const [referenceEntries, setReferenceEntries] = useState<{ key: string; value: string }[]>(() =>
    parseReferenceFromBody(entry.body)
  )
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [folders, setFolders] = useState<ToolFolder[]>([])

  useEffect(() => {
    window.electronAPI.listToolFolders().then(setFolders)
  }, [])

  const autoDetected = (isUrl && toolType === 'link') || (!isUrl && toolType === 'string')

  function isFormValid(): boolean {
    if (!name.trim()) return false
    if (toolType === 'reference') return referenceEntries.some((e) => e.key.trim())
    if (toolType === 'function') return value.trim() !== '' && parameters.every((p) => p.name.trim())
    return value.trim() !== ''
  }

  async function handleCreate() {
    if (!isFormValid()) return
    setSaving(true)
    try {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)

      let effectiveValue = value.trim()
      let finalParams: FunctionParameter[] | null = null

      if (toolType === 'reference') {
        effectiveValue = JSON.stringify(referenceEntries.filter((e) => e.key.trim()))
      } else if (toolType === 'function') {
        finalParams = parameters.map((p, i) => {
          if (p.type === 'list' || p.type === 'list-other') {
            const parsed = (optionsInputs[i] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
            return { ...p, options: parsed }
          }
          return p
        })
      }

      await window.electronAPI.createToolFromEntry(entry.id, name.trim(), toolType, effectiveValue, tags, finalParams, selectedFolderId)
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

  async function handleRestore() {
    setRestoring(true)
    try {
      await window.electronAPI.updateToolEntryStatus(entry.id, 'pending')
    } finally {
      setRestoring(false)
    }
  }

  function addParameter() {
    setParameters([...parameters, { name: '', type: 'text' }])
  }

  function removeParameter(index: number) {
    setParameters(parameters.filter((_, i) => i !== index))
    setOptionsInputs((prev) => {
      const next: Record<number, string> = {}
      let j = 0
      for (let i = 0; i < parameters.length; i++) {
        if (i !== index) {
          if (prev[i] !== undefined) next[j] = prev[i]
          j++
        }
      }
      return next
    })
  }

  function updateParameter(index: number, updates: Partial<FunctionParameter>) {
    if (updates.type && updates.type !== 'text') {
      updates = { ...updates, required: undefined }
    }
    setParameters(parameters.map((p, i) => i === index ? { ...p, ...updates } : p))
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
            {isAbandoned && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TOOL_ENTRY_STATUS_CLASS.abandoned}`}>Abandoned</span>
            )}
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
                {TYPE_CONFIG.map(({ type, label, activeClass }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setToolType(type)}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                      toolType === type ? activeClass : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {autoDetected
                ? <span className="text-[10px] text-gray-600 font-medium">auto-detected</span>
                : <span className="text-[10px] text-amber-500/70 font-medium">overridden</span>
              }
            </div>
          </div>

          {/* Source text (collapsible) */}
          <div>
            <button
              type="button"
              onClick={() => setSourceTextExpanded(!sourceTextExpanded)}
              className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-400 font-medium uppercase tracking-wider transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
                className={`w-3 h-3 transition-transform ${sourceTextExpanded ? 'rotate-90' : ''}`}>
                <path d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" />
              </svg>
              Source text
            </button>
            {sourceTextExpanded && (
              <div className="mt-1.5 px-3 py-2 text-xs text-gray-500 font-mono whitespace-pre-wrap break-words max-h-32 overflow-y-auto leading-relaxed">
                {entry.body}
              </div>
            )}
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

          {/* Type-specific fields */}
          {toolType === 'reference' ? (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <label className="block text-[11px] text-gray-500 font-medium uppercase tracking-wider">Entries</label>
                {referenceEntries.filter((e) => e.key.trim()).length > 0 && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-cyan-600/30 text-cyan-300 border border-cyan-500/30">
                    {referenceEntries.filter((e) => e.key.trim()).length} entr{referenceEntries.filter((e) => e.key.trim()).length !== 1 ? 'ies' : 'y'}
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex gap-2 items-center px-0.5">
                  <span className="flex-1 text-[10px] text-gray-500 font-medium">KEY</span>
                  <span className="flex-1 text-[10px] text-gray-500 font-medium">VALUE</span>
                  <span className="w-7"></span>
                </div>
                {referenceEntries.map((refEntry, i) => {
                  const isDuplicate = referenceEntries.some((e, j) => j !== i && e.key.trim() && e.key.trim() === refEntry.key.trim())
                  return (
                    <div key={i}>
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={refEntry.key}
                          onChange={(e) => setReferenceEntries(referenceEntries.map((re, ri) => ri === i ? { ...re, key: e.target.value } : re))}
                          placeholder="key"
                          className={`flex-1 min-w-0 bg-gray-800 border rounded-lg px-2.5 py-1.5 text-xs placeholder-gray-600 outline-none transition-colors font-mono ${
                            isDuplicate ? 'border-red-500/50 text-red-300' : 'border-gray-700 text-cyan-300 focus:border-cyan-500/60'
                          }`}
                        />
                        <input
                          type="text"
                          value={refEntry.value}
                          onChange={(e) => setReferenceEntries(referenceEntries.map((re, ri) => ri === i ? { ...re, value: e.target.value } : re))}
                          placeholder="value"
                          className={`flex-1 min-w-0 bg-gray-800 border rounded-lg px-2.5 py-1.5 text-xs text-gray-100 placeholder-gray-600 outline-none transition-colors font-mono ${
                            isDuplicate ? 'border-red-500/30' : 'border-gray-700 focus:border-cyan-500/60'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setReferenceEntries(referenceEntries.length <= 1 ? referenceEntries : referenceEntries.filter((_, ri) => ri !== i))}
                          className="px-1.5 py-1.5 text-xs text-red-400 hover:text-red-300 transition-colors flex-shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                      {isDuplicate && (
                        <div className="text-[10px] text-red-400 mt-0.5 ml-0.5">Duplicate key &ldquo;{refEntry.key.trim()}&rdquo;</div>
                      )}
                    </div>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setReferenceEntries([...referenceEntries, { key: '', value: '' }])}
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  + Add entry
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] text-gray-500 font-medium mb-1.5 uppercase tracking-wider">
                {toolType === 'link' ? 'URL' : toolType === 'function' ? 'Script' : toolType === 'content' ? 'Content' : 'Value'}
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
                  placeholder={toolType === 'function'
                    ? 'var url = "https://site.com/" + userId;\ncopy(userPlan);\nopenLink(url);'
                    : toolType === 'content'
                    ? 'Paste or type content...'
                    : undefined}
                  rows={toolType === 'function' ? 6 : toolType === 'content' ? 6 : 2}
                  className="w-full bg-gray-800 border border-gray-700/80 rounded-lg px-3 py-2 text-sm text-gray-100
                    font-mono placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors resize-none"
                />
              )}
              {toolType === 'function' && (
                <div className="mt-1.5 flex gap-3 text-[10px] text-gray-500">
                  <span><code className="text-emerald-500/70">copy(expr)</code> — clipboard</span>
                  <span><code className="text-emerald-500/70">openLink(expr)</code> — open URL</span>
                  <span><code className="text-emerald-500/70">var x = expr;</code> — variable</span>
                </div>
              )}
            </div>
          )}

          {/* Parameters (function type only) */}
          {toolType === 'function' && (
            <div>
              <label className="block text-[11px] text-gray-500 font-medium mb-1.5 uppercase tracking-wider">Parameters</label>
              <div className="space-y-2">
                {parameters.map((param, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex gap-2 items-start">
                      <input
                        type="text"
                        value={param.name}
                        onChange={(e) => updateParameter(i, { name: e.target.value })}
                        placeholder="param name"
                        className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-100
                          placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors font-mono"
                      />
                      <select
                        value={param.type}
                        onChange={(e) => updateParameter(i, { type: e.target.value as FunctionParameterType, options: e.target.value === 'text' ? undefined : param.options })}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-indigo-500/60 transition-colors flex-shrink-0"
                      >
                        {Object.entries(PARAM_TYPE_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeParameter(i)}
                        className="px-1.5 py-1.5 text-xs text-red-400 hover:text-red-300 transition-colors flex-shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                    {param.type === 'text' && (
                      <label className="flex items-center gap-1.5 ml-0.5">
                        <input
                          type="checkbox"
                          checked={param.required ?? false}
                          onChange={(e) => updateParameter(i, { required: e.target.checked || undefined })}
                          className="accent-indigo-500"
                        />
                        <span className="text-[11px] text-gray-500">Required</span>
                      </label>
                    )}
                    {(param.type === 'list' || param.type === 'list-other') && (
                      <input
                        type="text"
                        value={optionsInputs[i] ?? ''}
                        onChange={(e) => setOptionsInputs((prev) => ({ ...prev, [i]: e.target.value }))}
                        placeholder="values (comma-separated)"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-100
                          placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors"
                      />
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addParameter}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  + Add parameter
                </button>
              </div>
            </div>
          )}

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

          {/* Folder */}
          {folders.length > 0 && (
            <div>
              <label className="block text-[11px] text-gray-500 font-medium mb-1.5 uppercase tracking-wider">Folder</label>
              <FolderTreePicker
                folders={folders}
                selectedFolderId={selectedFolderId}
                onSelect={setSelectedFolderId}
              />
            </div>
          )}

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
            {isAbandoned ? (
              <button
                type="button"
                onClick={handleRestore}
                disabled={restoring}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-sky-400
                  hover:bg-sky-500/10 transition-colors disabled:opacity-40"
              >
                Restore
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingAbandon(true)}
                disabled={abandoning}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-red-400
                  hover:bg-red-500/10 transition-colors disabled:opacity-40"
              >
                Abandon
              </button>
            )}
            <button
              type="button"
              onClick={handleCreate}
              disabled={!isFormValid() || saving}
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
        data-tooltip="Abandon Tool Entry"
        message="Are you sure you want to abandon this tool entry? It won't appear in the conversion queue unless manually set back to pending."
        confirmLabel="Abandon"
        onConfirm={() => { setConfirmingAbandon(false); handleAbandon() }}
        onCancel={() => setConfirmingAbandon(false)}
      />
    )}
    </>
  )
}
