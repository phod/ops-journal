import { useState, useRef, useCallback } from 'react'
import { Modal } from '@shared/Modal'
import type { ToolType, FunctionParameter, FunctionParameterType } from '@shared/ipc-types'

const PARAM_TYPE_LABELS: Record<FunctionParameterType, string> = {
  'text': 'Free text',
  'list': 'List',
  'list-other': 'List + Other'
}

interface BulkRow {
  id: number
  name: string
  value: string
  extraTags: string
  showTags: boolean
  parameters: FunctionParameter[]
  optionsInputs: Record<number, string>
  referenceEntries: { key: string; value: string }[]
}

interface Props {
  onClose: () => void
}

let nextRowId = 1

function makeRow(): BulkRow {
  return { id: nextRowId++, name: '', value: '', extraTags: '', showTags: false, parameters: [], optionsInputs: {}, referenceEntries: [{ key: '', value: '' }] }
}

const TYPE_CONFIG: { type: ToolType; label: string; activeClass: string }[] = [
  { type: 'link', label: '↗ Link', activeClass: 'bg-indigo-600 text-white' },
  { type: 'string', label: '⌨ String', activeClass: 'bg-indigo-600 text-white' },
  { type: 'function', label: '⚡ Function', activeClass: 'bg-emerald-600 text-white' },
  { type: 'content', label: '📖 Content', activeClass: 'bg-purple-600 text-white' },
  { type: 'reference', label: '📋 Reference', activeClass: 'bg-cyan-600 text-white' },
]

export function BulkToolForm({ onClose }: Props) {
  const [toolType, setToolType] = useState<ToolType>('string')
  const [sharedTagsInput, setSharedTagsInput] = useState('')
  const [rows, setRows] = useState<BulkRow[]>(() => [makeRow()])
  const [saving, setSaving] = useState(false)
  const rowRefsMap = useRef<Map<number, HTMLInputElement>>(new Map())

  const isRowValid = useCallback((r: BulkRow) => {
    if (!r.name.trim()) return false
    if (toolType === 'reference') return r.referenceEntries.some((e) => e.key.trim())
    if (toolType === 'function') return r.value.trim() && r.parameters.every((p) => p.name.trim())
    return r.value.trim() !== ''
  }, [toolType])

  const validRows = rows.filter(isRowValid)

  const updateRow = useCallback((id: number, field: keyof BulkRow, val: string | boolean) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: val } : r)))
  }, [])

  const updateRowData = useCallback((id: number, updater: (row: BulkRow) => Partial<BulkRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updater(r) } : r)))
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

        let effectiveValue = row.value.trim()
        let parameters: FunctionParameter[] | null = null

        if (toolType === 'reference') {
          effectiveValue = JSON.stringify(row.referenceEntries.filter((e) => e.key.trim()))
        } else if (toolType === 'function') {
          parameters = row.parameters.map((p, i) => {
            if (p.type === 'list' || p.type === 'list-other') {
              const parsed = (row.optionsInputs[i] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
              return { ...p, options: parsed }
            }
            return p
          })
        }

        return { name: row.name.trim(), toolType, value: effectiveValue, tags: mergedTags, parameters }
      })
      await window.electronAPI.createToolsBulk(tools)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const isCompactType = toolType === 'link' || toolType === 'string'

  return (
    <Modal onClose={onClose} className={`p-6 ${isCompactType ? 'w-[600px]' : 'w-[680px]'}`}>
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
              {TYPE_CONFIG.map(({ type, label, activeClass }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setToolType(type)}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors capitalize
                    ${toolType === type ? activeClass : 'text-gray-400 hover:text-gray-200'}`}
                >
                  {label}
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
              {isCompactType ? (
                /* Compact row for link/string */
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
                  <RowActions row={row} rows={rows} updateRow={updateRow} removeRow={removeRow} />
                </div>
              ) : (
                /* Vertical layout for function/content/reference */
                <div className="border border-gray-700/40 rounded-lg p-3 space-y-2 bg-gray-800/20">
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
                    <RowActions row={row} rows={rows} updateRow={updateRow} removeRow={removeRow} />
                  </div>

                  {toolType === 'content' && (
                    <textarea
                      value={row.value}
                      onChange={(e) => updateRow(row.id, 'value', e.target.value)}
                      placeholder="Paste or type content..."
                      rows={3}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100
                        placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors resize-none font-mono"
                    />
                  )}

                  {toolType === 'function' && (
                    <>
                      <textarea
                        value={row.value}
                        onChange={(e) => updateRow(row.id, 'value', e.target.value)}
                        placeholder={'var url = "https://site.com/" + userId;\ncopy(userPlan);\nopenLink(url);'}
                        rows={3}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100
                          placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors resize-none font-mono"
                      />
                      <div className="flex gap-3 text-[10px] text-gray-500">
                        <span><code className="text-emerald-500/70">copy(expr)</code> — clipboard</span>
                        <span><code className="text-emerald-500/70">openLink(expr)</code> — open URL</span>
                        <span><code className="text-emerald-500/70">var x = expr;</code> — variable</span>
                      </div>
                      {/* Parameters */}
                      <div className="space-y-1.5 mt-1">
                        <div className="text-[11px] text-gray-500 font-medium">Parameters</div>
                        {row.parameters.map((param, i) => (
                          <div key={i} className="space-y-1">
                            <div className="flex gap-2 items-center">
                              <input
                                type="text"
                                value={param.name}
                                onChange={(e) => updateRowData(row.id, (r) => ({
                                  parameters: r.parameters.map((p, pi) => pi === i ? { ...p, name: e.target.value } : p)
                                }))}
                                placeholder="param name"
                                className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1 text-xs text-gray-100
                                  placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors font-mono"
                              />
                              <select
                                value={param.type}
                                onChange={(e) => updateRowData(row.id, (r) => ({
                                  parameters: r.parameters.map((p, pi) => pi === i ? { ...p, type: e.target.value as FunctionParameterType, options: e.target.value === 'text' ? undefined : p.options, required: e.target.value !== 'text' ? undefined : p.required } : p)
                                }))}
                                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-100 outline-none focus:border-indigo-500/60 transition-colors flex-shrink-0"
                              >
                                {Object.entries(PARAM_TYPE_LABELS).map(([val, label]) => (
                                  <option key={val} value={val}>{label}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => updateRowData(row.id, (r) => {
                                  const newParams = r.parameters.filter((_, pi) => pi !== i)
                                  const newOpts: Record<number, string> = {}
                                  let j = 0
                                  for (let k = 0; k < r.parameters.length; k++) {
                                    if (k !== i) {
                                      if (r.optionsInputs[k] !== undefined) newOpts[j] = r.optionsInputs[k]
                                      j++
                                    }
                                  }
                                  return { parameters: newParams, optionsInputs: newOpts }
                                })}
                                className="px-1 py-1 text-xs text-red-400 hover:text-red-300 transition-colors flex-shrink-0"
                              >
                                ✕
                              </button>
                            </div>
                            {param.type === 'text' && (
                              <label className="flex items-center gap-1.5 ml-0.5">
                                <input
                                  type="checkbox"
                                  checked={param.required ?? false}
                                  onChange={(e) => updateRowData(row.id, (r) => ({
                                    parameters: r.parameters.map((p, pi) => pi === i ? { ...p, required: e.target.checked || undefined } : p)
                                  }))}
                                  className="accent-indigo-500"
                                />
                                <span className="text-[10px] text-gray-500">Required</span>
                              </label>
                            )}
                            {(param.type === 'list' || param.type === 'list-other') && (
                              <input
                                type="text"
                                value={row.optionsInputs[i] ?? ''}
                                onChange={(e) => updateRowData(row.id, (r) => ({
                                  optionsInputs: { ...r.optionsInputs, [i]: e.target.value }
                                }))}
                                placeholder="values (comma-separated)"
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1 text-xs text-gray-100
                                  placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors"
                              />
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => updateRowData(row.id, (r) => ({
                            parameters: [...r.parameters, { name: '', type: 'text' as FunctionParameterType }]
                          }))}
                          className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          + Add parameter
                        </button>
                      </div>
                    </>
                  )}

                  {toolType === 'reference' && (
                    <div className="space-y-1.5">
                      <div className="flex gap-2 items-center px-0.5">
                        <span className="flex-1 text-[10px] text-gray-500 font-medium">KEY</span>
                        <span className="flex-1 text-[10px] text-gray-500 font-medium">VALUE</span>
                        <span className="w-6"></span>
                      </div>
                      {row.referenceEntries.map((entry, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={entry.key}
                            onChange={(e) => updateRowData(row.id, (r) => ({
                              referenceEntries: r.referenceEntries.map((re, ri) => ri === i ? { ...re, key: e.target.value } : re)
                            }))}
                            placeholder="key"
                            className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1 text-xs text-cyan-300
                              placeholder-gray-600 outline-none focus:border-cyan-500/60 transition-colors font-mono"
                          />
                          <input
                            type="text"
                            value={entry.value}
                            onChange={(e) => updateRowData(row.id, (r) => ({
                              referenceEntries: r.referenceEntries.map((re, ri) => ri === i ? { ...re, value: e.target.value } : re)
                            }))}
                            placeholder="value"
                            className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1 text-xs text-gray-100
                              placeholder-gray-600 outline-none focus:border-cyan-500/60 transition-colors font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => updateRowData(row.id, (r) => ({
                              referenceEntries: r.referenceEntries.length <= 1 ? r.referenceEntries : r.referenceEntries.filter((_, ri) => ri !== i)
                            }))}
                            className="px-1 py-1 text-xs text-red-400 hover:text-red-300 transition-colors flex-shrink-0"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => updateRowData(row.id, (r) => ({
                          referenceEntries: [...r.referenceEntries, { key: '', value: '' }]
                        }))}
                        className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        + Add entry
                      </button>
                    </div>
                  )}
                </div>
              )}
              {row.showTags && (
                <div className={isCompactType ? 'ml-7 mt-1' : 'mt-1 px-3'}>
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

function RowActions({ row, rows, updateRow, removeRow }: { row: BulkRow; rows: BulkRow[]; updateRow: (id: number, field: keyof BulkRow, val: string | boolean) => void; removeRow: (id: number) => void }) {
  return (
    <>
      <button
        type="button"
        onClick={() => updateRow(row.id, 'showTags', !row.showTags)}
        data-tooltip="Per-row tags"
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
        data-tooltip="Remove row"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
          <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
        </svg>
      </button>
    </>
  )
}
