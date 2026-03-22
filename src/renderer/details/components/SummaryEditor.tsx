import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import DropCursor from '@tiptap/extension-dropcursor'
import { useState, useRef, useImperativeHandle, forwardRef } from 'react'
import type { JournalEntry } from '@shared/ipc-types'
import { resolveLinkedFindings, resolveLinkedActions, resolveChildHypotheses, resolveParentHypotheses } from '@shared/entry-types'
import { EntryRefNode } from './editor/EntryRefNode'
import { SummaryImageNode } from './editor/SummaryImageNode'

export interface SummaryEditorHandle {
  insertEntryRef: (entry: JournalEntry) => void
  insertImage: (imagePath: string) => void
  isDirty: () => boolean
}

interface Props {
  investigationId: string
  initialJson: string | null
  entries: JournalEntry[]
  onSave: (json: string) => void
  onCancel: () => void
}

function buildChildHypothesisTree(entry: JournalEntry, allEntries: JournalEntry[], visited: Set<string> = new Set()): any[] {
  if (entry.type !== 'hypothesis') return []
  return resolveChildHypotheses(entry, allEntries)
    .filter((h) => !visited.has(h.id))
    .map((h) => {
      const nextVisited = new Set(visited)
      nextVisited.add(h.id)
      return {
        id: h.id,
        body: h.body,
        status: h.hypothesis_status ?? 'open',
        findings: resolveLinkedFindings(h, allEntries).map((f) => ({ id: f.id, body: f.body })),
        actions: resolveLinkedActions(h, allEntries).map((a) => ({ id: a.id, body: a.body })),
        children: buildChildHypothesisTree(h, allEntries, nextVisited)
      }
    })
}

function entryRefAttrs(entry: JournalEntry, allEntries: JournalEntry[]) {
  return {
    entryId: entry.id,
    entryType: entry.type,
    entryBody: entry.body,
    entryTimestamp: entry.created_at,
    entryImagePaths: entry.image_paths,
    entryHypothesisStatus: entry.hypothesis_status ?? null,
    entryLinkedFindings: resolveLinkedFindings(entry, allEntries).map((f) => ({ id: f.id, body: f.body })),
    entryLinkedActions: resolveLinkedActions(entry, allEntries).map((a) => ({ id: a.id, body: a.body })),
    entryChildHypotheses: buildChildHypothesisTree(entry, allEntries),
    entryParentHypotheses: resolveParentHypotheses(entry, allEntries).map((h) => ({ id: h.id, body: h.body, status: h.hypothesis_status ?? 'open' })),
    entryFlagged: entry.flagged ?? false
  }
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
        SummaryImageNode,
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

          const node = view.state.schema.nodes.entryRef?.create(
            entryRefAttrs(entry, entriesRef.current)
          )
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
          .insertContent({ type: 'entryRef', attrs: entryRefAttrs(entry, entriesRef.current) })
          .run()
      },
      insertImage: (imagePath: string) => {
        if (!editor) return
        editor
          .chain()
          .focus()
          .insertContent({ type: 'summaryImage', attrs: { src: imagePath } })
          .run()
      },
      isDirty: () => {
        if (!editor) return false
        const current = JSON.stringify(editor.getJSON())
        const original = initialJson ?? JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] })
        return current !== original
      }
    }))

    async function handleUploadImage(): Promise<void> {
      const dataUrls = await window.electronAPI.pickImage()
      for (const dataUrl of dataUrls) {
        const path = await window.electronAPI.saveSummaryImage(dataUrl)
        editor?.chain().focus().insertContent({ type: 'summaryImage', attrs: { src: path } }).run()
      }
    }

    async function handleScreenshot(): Promise<void> {
      const dataUrl = await window.electronAPI.captureScreenshot()
      if (!dataUrl) return
      const path = await window.electronAPI.saveSummaryImage(dataUrl)
      editor?.chain().focus().insertContent({ type: 'summaryImage', attrs: { src: path } }).run()
    }

    async function handleSave(): Promise<void> {
      if (!editor) return
      setSaving(true)
      const json = JSON.stringify(editor.getJSON())
      await window.electronAPI.saveSummary(investigationId, json)
      setSaving(false)
      onSave(json)
    }

    return (
      <div className="flex flex-col gap-3 flex-1 min-h-0">
        {/* Toolbar */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleUploadImage}
            className="text-xs px-2.5 py-1 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors font-mono"
            data-tooltip="Upload image"
          >
            ↑ Upload
          </button>
          <button
            onClick={handleScreenshot}
            className="text-xs px-2.5 py-1 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors font-mono"
            data-tooltip="Capture screenshot"
          >
            ⌘ Screenshot
          </button>
        </div>

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
