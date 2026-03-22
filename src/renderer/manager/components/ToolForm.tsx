import { useState } from 'react'
import { Modal } from '@shared/Modal'
import type { Tool, ToolType, FunctionParameter, FunctionParameterType } from '@shared/ipc-types'

interface Props {
  tool: Tool | null
  folderId?: string | null
  onClose: () => void
}

const PARAM_TYPE_LABELS: Record<FunctionParameterType, string> = {
  'text': 'Free text',
  'list': 'List',
  'list-other': 'List + Other'
}

export function ToolForm({ tool, folderId, onClose }: Props) {
  const isEditing = !!tool
  const [name, setName] = useState(tool?.name ?? '')
  const [toolType, setToolType] = useState<ToolType>(tool?.tool_type ?? 'string')
  const [value, setValue] = useState(tool?.value ?? '')
  const [tagsInput, setTagsInput] = useState(tool?.tags.join(', ') ?? '')
  const [saving, setSaving] = useState(false)
  const [parameters, setParameters] = useState<FunctionParameter[]>(tool?.parameters ?? [])
  const [referenceEntries, setReferenceEntries] = useState<{ key: string; value: string }[]>(() => {
    if (tool?.tool_type === 'reference') {
      try { return JSON.parse(tool.value) } catch { return [{ key: '', value: '' }] }
    }
    return [{ key: '', value: '' }]
  })
  const [optionsInputs, setOptionsInputs] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {}
    for (let i = 0; i < (tool?.parameters ?? []).length; i++) {
      const p = (tool?.parameters ?? [])[i]
      if (p.options) init[i] = p.options.join(', ')
    }
    return init
  })

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
    // Clear required flag when switching away from text type
    if (updates.type && updates.type !== 'text') {
      updates = { ...updates, required: undefined }
    }
    setParameters(parameters.map((p, i) => i === index ? { ...p, ...updates } : p))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const effectiveValue = toolType === 'reference' ? JSON.stringify(referenceEntries.filter((e) => e.key.trim())) : value
    if (!name.trim() || (!effectiveValue.trim() && toolType !== 'reference')) return
    if (toolType === 'reference' && referenceEntries.filter((e) => e.key.trim()).length === 0) return
    if (toolType === 'function' && parameters.some((p) => !p.name.trim())) return

    setSaving(true)
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
    // Parse options from raw input strings before submitting
    const finalParams = toolType === 'function' ? parameters.map((p, i) => {
      if (p.type === 'list' || p.type === 'list-other') {
        const parsed = (optionsInputs[i] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
        return { ...p, options: parsed }
      }
      return p
    }) : null
    const params = finalParams
    try {
      if (isEditing) {
        await window.electronAPI.updateTool(tool.id, name.trim(), toolType, effectiveValue.trim(), tags, params)
      } else {
        await window.electronAPI.createTool(name.trim(), toolType, effectiveValue.trim(), tags, folderId, params)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} className="p-6 w-[460px] max-h-[90vh] overflow-y-auto">
      <h3 className="text-gray-100 font-semibold text-sm mb-4">
        {isEditing ? 'Edit Tool' : 'New Tool'}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type toggle */}
        <div>
          <label className="block text-xs text-gray-400 font-medium mb-1.5">Type</label>
          <div className="flex gap-1 p-0.5 bg-gray-700/60 rounded-lg w-fit">
            {(['link', 'string', 'function', 'content', 'reference'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setToolType(t)}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors capitalize
                  ${toolType === t
                    ? t === 'function' ? 'bg-emerald-600 text-white' : t === 'content' ? 'bg-purple-600 text-white' : t === 'reference' ? 'bg-cyan-600 text-white' : 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                  }`}
              >
                {t === 'link' ? '↗ Link' : t === 'function' ? '⚡ Function' : t === 'content' ? '📖 Content' : t === 'reference' ? '📋 Reference' : '⌨ String'}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-xs text-gray-400 font-medium mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Grafana Dashboard"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100
              placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors"
            autoFocus
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs text-gray-400 font-medium mb-1.5">Tags <span className="text-gray-600">(comma-separated)</span></label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="e.g. monitoring, production"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100
              placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors"
          />
        </div>

        {/* Parameters (function type only) */}
        {toolType === 'function' && (
          <div>
            <label className="block text-xs text-gray-400 font-medium mb-1.5">Parameters</label>
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
                      onChange={(e) => {
                        setOptionsInputs((prev) => ({ ...prev, [i]: e.target.value }))
                      }}
                      onBlur={() => {
                        const parsed = (optionsInputs[i] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
                        updateParameter(i, { options: parsed })
                      }}
                      placeholder="values (comma-separated)"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-100
                        placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors ml-0"
                    />
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addParameter}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                + Add parameter
              </button>
            </div>
          </div>
        )}

        {/* Value / Script / Entries */}
        {toolType === 'reference' ? (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <label className="block text-xs text-gray-400 font-medium">Entries</label>
              {referenceEntries.filter((e) => e.key.trim()).length > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-600/30 text-indigo-300 border border-indigo-500/30">
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
              {referenceEntries.map((entry, i) => {
                const isDuplicate = referenceEntries.some((e, j) => j !== i && e.key.trim() && e.key.trim() === entry.key.trim())
                return (
                  <div key={i}>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={entry.key}
                        onChange={(e) => setReferenceEntries(referenceEntries.map((re, ri) => ri === i ? { ...re, key: e.target.value } : re))}
                        placeholder="key"
                        className={`flex-1 min-w-0 bg-gray-800 border rounded-lg px-2.5 py-1.5 text-xs placeholder-gray-600 outline-none transition-colors font-mono ${
                          isDuplicate ? 'border-red-500/50 text-red-300' : 'border-gray-700 text-cyan-300 focus:border-cyan-500/60'
                        }`}
                      />
                      <input
                        type="text"
                        value={entry.value}
                        onChange={(e) => setReferenceEntries(referenceEntries.map((re, ri) => ri === i ? { ...re, value: e.target.value } : re))}
                        placeholder="value"
                        className={`flex-1 min-w-0 bg-gray-800 border rounded-lg px-2.5 py-1.5 text-xs text-gray-100 placeholder-gray-600 outline-none transition-colors font-mono ${
                          isDuplicate ? 'border-red-500/30' : 'border-gray-700 focus:border-cyan-500/60'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setReferenceEntries(referenceEntries.filter((_, ri) => ri !== i))}
                        className="px-1.5 py-1.5 text-xs text-red-400 hover:text-red-300 transition-colors flex-shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                    {isDuplicate && (
                      <div className="text-[10px] text-red-400 mt-0.5 ml-0.5">Duplicate key &ldquo;{entry.key.trim()}&rdquo;</div>
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
          <label className="block text-xs text-gray-400 font-medium mb-1.5">
            {toolType === 'link' ? 'URL' : toolType === 'function' ? 'Script' : toolType === 'content' ? 'Content' : 'Text'}
          </label>
          {toolType === 'link' ? (
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100
                placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors"
            />
          ) : (
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={toolType === 'function'
                ? 'var url = "https://site.com/" + userId;\ncopy(userPlan);\nopenLink(url);'
                : toolType === 'content'
                ? 'Paste or type content...'
                : 'kubectl get pods -n production'}
              rows={toolType === 'function' ? 6 : toolType === 'content' ? 8 : 4}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100
                placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors resize-none font-mono"
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

        {/* Actions */}
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
            disabled={!name.trim() || saving || (toolType === 'reference' ? (referenceEntries.filter((e) => e.key.trim()).length === 0 || referenceEntries.some((e, i) => e.key.trim() && referenceEntries.some((e2, j) => j !== i && e2.key.trim() === e.key.trim())) || referenceEntries.some((e) => e.key.trim() && !e.value.trim())) : (!value.trim() || (toolType === 'function' && (parameters.some((p) => !p.name.trim()) || parameters.some((p, i) => (p.type === 'list' || p.type === 'list-other') && !(optionsInputs[i] ?? '').split(',').some((s) => s.trim()))))))}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500
              text-white transition-colors disabled:opacity-40"
          >
            {isEditing ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
