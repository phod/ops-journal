import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import DropCursor from '@tiptap/extension-dropcursor'
import { useState, useRef, useImperativeHandle, forwardRef } from 'react'
import type { JournalEntry } from '@shared/ipc-types'
import { EntryRefNode } from './editor/EntryRefNode'

export interface SummaryEditorHandle {
  insertEntryRef: (entry: JournalEntry) => void
}

interface Props {
  investigationId: string
  initialJson: string | null
  entries: JournalEntry[]
  onSave: (json: string) => void
  onCancel: () => void
}

export const SummaryEditor = forwardRef<SummaryEditorHandle, Props>(
  ({ investigationId, initialJson, entries, onSave, onCancel }, ref) => {
    const [saving, setSaving] = useState(false)
    const entriesRef = useRef(entries)
    entriesRef.current = entries

    const editor = useEditor({
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder: 'Write your summary…' }),
        EntryRefNode,
        DropCursor.configure({ color: '#3b82f6', width: 2 })
      ],
      content: initialJson ? JSON.parse(initialJson) : undefined,
      editorProps: {
        attributes: {
          class:
            'outline-none min-h-[200px] prose prose-invert prose-sm max-w-none font-mono text-gray-100 [&_p]:my-1 [&_h1]:text-gray-100 [&_h2]:text-gray-200 [&_h3]:text-gray-300 [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4'
        },
        handleDrop: (view, event) => {
          const entryId = event.dataTransfer?.getData('application/x-ops-entry-ref')
          if (!entryId) return false

          const entry = entriesRef.current.find((e) => e.id === entryId)
          if (!entry) return false

          const coords = { left: event.clientX, top: event.clientY }
          const pos = view.posAtCoords(coords)
          if (!pos) return false

          const node = view.state.schema.nodes.entryRef?.create({
            entryId: entry.id,
            entryType: entry.type,
            entryBody: entry.body,
            entryTimestamp: entry.created_at
          })
          if (!node) return false

          const tr = view.state.tr.insert(pos.pos, node)
          view.dispatch(tr)
          event.preventDefault()
          return true
        }
      }
    })

    useImperativeHandle(ref, () => ({
      insertEntryRef: (entry: JournalEntry) => {
        if (!editor) return
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'entryRef',
            attrs: {
              entryId: entry.id,
              entryType: entry.type,
              entryBody: entry.body,
              entryTimestamp: entry.created_at
            }
          })
          .run()
      }
    }))

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
)
