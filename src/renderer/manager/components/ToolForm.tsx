import { useState } from 'react'
import { Modal } from '@shared/Modal'
import type { Tool, ToolType } from '@shared/ipc-types'

interface Props {
  tool: Tool | null
  onClose: () => void
}

export function ToolForm({ tool, onClose }: Props) {
  const isEditing = !!tool
  const [name, setName] = useState(tool?.name ?? '')
  const [toolType, setToolType] = useState<ToolType>(tool?.tool_type ?? 'link')
  const [value, setValue] = useState(tool?.value ?? '')
  const [tagsInput, setTagsInput] = useState(tool?.tags.join(', ') ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !value.trim()) return

    setSaving(true)
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
    try {
      if (isEditing) {
        await window.electronAPI.updateTool(tool.id, name.trim(), toolType, value.trim(), tags)
      } else {
        await window.electronAPI.createTool(name.trim(), toolType, value.trim(), tags)
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

        {/* Value */}
        <div>
          <label className="block text-xs text-gray-400 font-medium mb-1.5">
            {toolType === 'link' ? 'URL' : 'Text'}
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
              placeholder="kubectl get pods -n production"
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100
                placeholder-gray-600 outline-none focus:border-indigo-500/60 transition-colors resize-none font-mono"
            />
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
            disabled={!name.trim() || !value.trim() || saving}
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
