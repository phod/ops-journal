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
    setParameters(parameters.map((p, i) => i === index ? { ...p, ...updates } : p))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !value.trim()) return
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
        await window.electronAPI.updateTool(tool.id, name.trim(), toolType, value.trim(), tags, params)
      } else {
        await window.electronAPI.createTool(name.trim(), toolType, value.trim(), tags, folderId, params)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} className="p-6 w-[460px]">
      <h3 className="text-gray-100 font-semibold text-sm mb-4">
        {isEditing ? 'Edit Tool' : 'New Tool'}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type toggle */}
        <div>
          <label className="block text-xs text-gray-400 font-medium mb-1.5">Type</label>
          <div className="flex gap-1 p-0.5 bg-gray-700/60 rounded-lg w-fit">
            {(['link', 'string', 'function'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setToolType(t)}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors capitalize
                  ${toolType === t
                    ? t === 'function' ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                  }`}
              >
                {t === 'link' ? '↗ Link' : t === 'function' ? '⚡ Function' : '⌨ String'}
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
                <div key={i} className="flex gap-2 items-start">
                  <input
                    type="text"
                    value={param.name}
                    onChange={(e) => updateParameter(i, { name: e.target.value })}
                    placeholder="param name"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-100
                      placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors font-mono"
                  />
                  <select
                    value={param.type}
                    onChange={(e) => updateParameter(i, { type: e.target.value as FunctionParameterType, options: e.target.value === 'text' ? undefined : param.options })}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-indigo-500/60 transition-colors"
                  >
                    {Object.entries(PARAM_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
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
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-100
                        placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeParameter(i)}
                    className="px-1.5 py-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    ✕
                  </button>
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

        {/* Value / Script */}
        <div>
          <label className="block text-xs text-gray-400 font-medium mb-1.5">
            {toolType === 'link' ? 'URL' : toolType === 'function' ? 'Script' : 'Text'}
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
                : 'kubectl get pods -n production'}
              rows={toolType === 'function' ? 6 : 4}
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
            disabled={!name.trim() || !value.trim() || saving || (toolType === 'function' && parameters.some((p) => !p.name.trim()))}
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
