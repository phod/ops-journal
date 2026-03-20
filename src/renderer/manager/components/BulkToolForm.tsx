import { useState, useRef, useCallback } from 'react'
import { Modal } from '@shared/Modal'
import type { ToolType } from '@shared/ipc-types'

interface BulkRow {
  id: number
  name: string
  value: string
  extraTags: string
  showTags: boolean
}

interface Props {
  onClose: () => void
}

let nextRowId = 1

function makeRow(): BulkRow {
  return { id: nextRowId++, name: '', value: '', extraTags: '', showTags: false }
}

export function BulkToolForm({ onClose }: Props) {
  const [toolType, setToolType] = useState<ToolType>('string')
  const [sharedTagsInput, setSharedTagsInput] = useState('')
  const [rows, setRows] = useState<BulkRow[]>(() => [makeRow()])
  const [saving, setSaving] = useState(false)
  const rowRefsMap = useRef<Map<number, HTMLInputElement>>(new Map())

  const validRows = rows.filter((r) => r.name.trim() && r.value.trim())

  const updateRow = useCallback((id: number, field: keyof BulkRow, val: string | boolean) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: val } : r)))
  }, [])

  function addRow() {
    const newRow = makeRow()
    setRows((prev) => [...prev, newRow])
    requestAnimationFrame(() => {
      rowRefsMap.current.get(newRow.id)?.focus()
    })
  }

  function removeRow(id: number) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (validRows.length === 0) return

    setSaving(true)
    try {
      const sharedTags = sharedTagsInput.split(',').map((t) => t.trim()).filter(Boolean)
      const tools = validRows.map((row) => {
        const rowTags = row.extraTags.split(',').map((t) => t.trim()).filter(Boolean)
        const mergedTags = [...new Set([...sharedTags, ...rowTags])]
        return { name: row.name.trim(), toolType, value: row.value.trim(), tags: mergedTags }
      })
      await window.electronAPI.createToolsBulk(tools)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} className="p-6 w-[600px]">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-gray-100 font-semibold text-sm">Bulk Create Tools</h3>
        {validRows.length > 0 && (
          <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-indigo-600/30 text-indigo-300">
            {validRows.length} tool{validRows.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Shared fields */}
        <div className="border border-gray-700/60 rounded-lg p-3 space-y-3 bg-gray-800/30">
          <div className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">Shared Fields</div>
          <div>
            <label className="block text-xs text-gray-400 font-medium mb-1.5">Type</label>
            <div className="flex gap-1 p-0.5 bg-gray-700/60 rounded-lg w-fit">
              {(['link', 'string'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setToolType(t)}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors capitalize
                    ${toolType === t
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                    }`}
                >
                  {t === 'link' ? '↗ Link' : '⌨ String'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 font-medium mb-1.5">
              Shared Tags <span className="text-gray-600">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={sharedTagsInput}
              onChange={(e) => setSharedTagsInput(e.target.value)}
              placeholder="e.g. runbook, production"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100
                placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors"
            />
          </div>
        </div>

        {/* Rows */}
        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
          {rows.map((row, idx) => (
            <div key={row.id} className="group">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-600 w-5 text-right shrink-0">{idx + 1}</span>
                <input
                  ref={(el) => {
                    if (el) rowRefsMap.current.set(row.id, el)
                    else rowRefsMap.current.delete(row.id)
                  }}
                  type="text"
                  value={row.name}
                  onChange={(e) => updateRow(row.id, 'name', e.target.value)}
                  placeholder="Name"
                  className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100
                    placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors"
                />
                <input
                  type="text"
                  value={row.value}
                  onChange={(e) => updateRow(row.id, 'value', e.target.value)}
                  placeholder={toolType === 'link' ? 'https://...' : 'Value'}
                  className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100
                    placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => updateRow(row.id, 'showTags', !row.showTags)}
                  title="Per-row tags"
                  className="relative p-1.5 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M4.5 2A2.5 2.5 0 0 0 2 4.5v2.879a2.5 2.5 0 0 0 .732 1.767l4.5 4.5a2.5 2.5 0 0 0 3.536 0l2.878-2.878a2.5 2.5 0 0 0 0-3.536l-4.5-4.5A2.5 2.5 0 0 0 7.379 2H4.5ZM5 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                  </svg>
                  {row.extraTags.trim() && (
                    <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length <= 1}
                  className="p-1.5 text-gray-600 hover:text-red-400 transition-colors disabled:opacity-30 disabled:hover:text-gray-600"
                  title="Remove row"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                  </svg>
                </button>
              </div>
              {row.showTags && (
                <div className="ml-7 mt-1">
                  <input
                    type="text"
                    value={row.extraTags}
                    onChange={(e) => updateRow(row.id, 'extraTags', e.target.value)}
                    placeholder="+ extra tags for this row"
                    className="w-full bg-gray-800/60 border border-gray-700/50 rounded-md px-3 py-1 text-xs text-gray-300
                      placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addRow}
          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
        >
          + Add another
        </button>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-700 text-gray-300
              hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={validRows.length === 0 || saving}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500
              text-white transition-colors disabled:opacity-40"
          >
            Create {validRows.length} Tool{validRows.length !== 1 ? 's' : ''}
          </button>
        </div>
      </form>
    </Modal>
  )
}
