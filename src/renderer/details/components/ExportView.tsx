import { useState } from 'react'
import type { ExportFormat, JournalEntry } from '@shared/ipc-types'

interface ExportViewProps {
  investigationId: string
  investigationName: string
  entries: JournalEntry[]
  onBack: () => void
}

const TYPE_LABELS: Record<string, string> = {
  note: 'Note',
  action: 'Action',
  finding: 'Finding',
  hypothesis: 'Hypothesis'
}

const TYPE_COLORS: Record<string, string> = {
  finding: 'text-green-400 border-green-700/50 bg-green-900/20',
  action: 'text-blue-400 border-blue-700/50 bg-blue-900/20',
  hypothesis: 'text-yellow-400 border-yellow-700/50 bg-yellow-900/20',
  note: 'text-gray-400 border-gray-600/50 bg-gray-700/20'
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function ExportView({ investigationId, investigationName, entries, onBack }: ExportViewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(entries.map((e) => e.id)))
  const [format, setFormat] = useState<ExportFormat>('markdown')
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null)

  const allTypes = [...new Set(entries.map((e) => e.type))]

  function toggleEntry(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(entries.map((e) => e.id)))
  }

  function deselectAll() {
    setSelectedIds(new Set())
  }

  function toggleType(type: string) {
    const typeIds = entries.filter((e) => e.type === type).map((e) => e.id)
    const allSelected = typeIds.every((id) => selectedIds.has(id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        typeIds.forEach((id) => next.delete(id))
      } else {
        typeIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  async function handleExport() {
    setExporting(true)
    setResult(null)
    try {
      const res = await window.electronAPI.exportInvestigation({
        investigationId,
        investigationName,
        format,
        entryIds: entries.filter((e) => selectedIds.has(e.id)).map((e) => e.id)
      })
      setResult(res)
    } finally {
      setExporting(false)
    }
  }

  const formatButtons: { key: ExportFormat; label: string; description: string }[] = [
    { key: 'markdown', label: 'Markdown', description: 'Save as .md file' },
    { key: 'pdf', label: 'PDF', description: 'Save as .pdf file' },
    { key: 'clipboard', label: 'Clipboard', description: 'Copy as markdown' }
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-gray-200 text-sm transition-colors flex-shrink-0"
        >
          ← Back
        </button>
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Export Investigation</h3>
      </div>

      <div className="flex flex-col gap-5 overflow-y-auto flex-1 min-h-0">
        {/* Format selector */}
        <div>
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">Format</div>
          <div className="flex gap-2">
            {formatButtons.map(({ key, label, description }) => (
              <button
                key={key}
                onClick={() => setFormat(key)}
                className={`flex-1 px-3 py-2.5 rounded border text-sm font-medium transition-colors text-left ${
                  format === key
                    ? 'border-blue-500 bg-blue-900/30 text-blue-300'
                    : 'border-gray-600 bg-gray-800/40 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                }`}
              >
                <div>{label}</div>
                <div className={`text-xs mt-0.5 ${format === key ? 'text-blue-400/70' : 'text-gray-600'}`}>
                  {description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Bulk actions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">
              Entries ({selectedIds.size} / {entries.length} selected)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                All
              </button>
              <span className="text-gray-700">·</span>
              <button
                onClick={deselectAll}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                None
              </button>
              {allTypes.map((type) => {
                const typeIds = entries.filter((e) => e.type === type).map((e) => e.id)
                const allSelected = typeIds.every((id) => selectedIds.has(id))
                return (
                  <span key={type} className="flex items-center gap-1">
                    <span className="text-gray-700">·</span>
                    <button
                      onClick={() => toggleType(type)}
                      className={`text-xs transition-colors ${allSelected ? 'text-gray-300' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      {TYPE_LABELS[type] ?? type}s
                    </button>
                  </span>
                )
              })}
            </div>
          </div>

          {/* Entry checklist */}
          <div className="flex flex-col gap-1.5">
            {entries.map((entry) => {
              const selected = selectedIds.has(entry.id)
              const colorClass = TYPE_COLORS[entry.type] ?? TYPE_COLORS.note
              const truncated = entry.body.length > 100 ? entry.body.slice(0, 100) + '…' : entry.body
              return (
                <label
                  key={entry.id}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded border cursor-pointer transition-colors ${
                    selected
                      ? 'border-gray-600 bg-gray-800/40'
                      : 'border-gray-700/30 bg-gray-800/10 opacity-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleEntry(entry.id)}
                    className="mt-0.5 flex-shrink-0 accent-blue-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${colorClass}`}>
                        {TYPE_LABELS[entry.type] ?? entry.type}
                      </span>
                      <span className="text-xs text-gray-600">{formatTimestamp(entry.created_at)}</span>
                      {entry.image_paths.length > 0 && (
                        <span className="text-xs text-gray-600">· {entry.image_paths.length} image{entry.image_paths.length > 1 ? 's' : ''}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 font-mono leading-relaxed">{truncated}</div>
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-700/50 mt-4 flex-shrink-0">
        {result && (
          <div className={`text-xs ${result.success ? 'text-green-400' : 'text-red-400'}`}>
            {result.success ? (format === 'clipboard' ? 'Copied to clipboard!' : 'Exported successfully!') : `Error: ${result.error}`}
          </div>
        )}
        {!result && <div />}
        <button
          onClick={handleExport}
          disabled={exporting || selectedIds.size === 0}
          className="text-xs px-4 py-1.5 rounded font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {exporting ? 'Exporting…' : `Export ${selectedIds.size} ${selectedIds.size === 1 ? 'entry' : 'entries'}`}
        </button>
      </div>
    </div>
  )
}
