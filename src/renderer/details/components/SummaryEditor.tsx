import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useState } from 'react'

interface Props {
  investigationId: string
  initialJson: string | null
  onSave: (json: string) => void
  onCancel: () => void
}

export function SummaryEditor({ investigationId, initialJson, onSave, onCancel }: Props) {
  const [saving, setSaving] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write your summary…' })
    ],
    content: initialJson ? JSON.parse(initialJson) : undefined,
    editorProps: {
      attributes: {
        class:
          'outline-none min-h-[300px] prose prose-invert prose-sm max-w-none font-mono text-gray-100 [&_p]:my-1 [&_h1]:text-gray-100 [&_h2]:text-gray-200 [&_h3]:text-gray-300 [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4'
      }
    }
  })

  async function handleSave(): Promise<void> {
    if (!editor) return
    setSaving(true)
    const json = JSON.stringify(editor.getJSON())
    await window.electronAPI.saveSummary(investigationId, json)
    setSaving(false)
    onSave(json)
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex-1 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 focus-within:border-gray-500 transition-colors">
        <EditorContent editor={editor} className="h-full" />
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded text-gray-400 hover:text-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs px-4 py-1.5 rounded font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
