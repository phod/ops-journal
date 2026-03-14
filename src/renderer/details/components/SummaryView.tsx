import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { JournalEntry } from '@shared/ipc-types'
import { SummaryEditor } from './SummaryEditor'
import type { SummaryEditorHandle } from './SummaryEditor'
import { SummaryEntryPanel } from './SummaryEntryPanel'
import { EntryRefNode } from './editor/EntryRefNode'

interface Props {
  investigationId: string
}

function ReadOnlyRenderer({ summaryJson }: { summaryJson: string }) {
  const editor = useEditor({
    extensions: [StarterKit, EntryRefNode],
    content: JSON.parse(summaryJson),
    editable: false,
    editorProps: {
      attributes: {
        class:
          'outline-none prose prose-invert prose-sm max-w-none font-mono text-gray-100 [&_p]:my-1 [&_h1]:text-gray-100 [&_h2]:text-gray-200 [&_h3]:text-gray-300 [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4'
      }
    }
  })

  return <EditorContent editor={editor} />
}

export function SummaryView({ investigationId }: Props) {
  const [summaryJson, setSummaryJson] = useState<string | null>(null)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const editorRef = useRef<SummaryEditorHandle>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      window.electronAPI.getSummary(investigationId),
      window.electronAPI.listEntries(investigationId)
    ]).then(([json, entryList]) => {
      setSummaryJson(json)
      setEntries(entryList)
      setLoading(false)
    })
  }, [investigationId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500 text-sm font-mono">
        Loading…
      </div>
    )
  }

  if (editing) {
    return (
      <div className="flex gap-4 h-full min-h-0">
        {/* Editor — left column */}
        <div className="flex-[3] min-w-0 flex flex-col">
          <SummaryEditor
            ref={editorRef}
            investigationId={investigationId}
            initialJson={summaryJson}
            entries={entries}
            onSave={(json) => {
              setSummaryJson(json)
              setEditing(false)
            }}
            onCancel={() => setEditing(false)}
          />
        </div>

        {/* Side panel — right column */}
        <div className="flex-[2] min-w-0 min-h-0 border-l border-gray-700/50 pl-4 flex flex-col">
          <SummaryEntryPanel
            entries={entries}
            onInsert={(entry) => editorRef.current?.insertEntryRef(entry)}
          />
        </div>
      </div>
    )
  }

  if (!summaryJson) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p className="text-gray-500 text-sm font-mono">No summary yet.</p>
        <button
          onClick={() => setEditing(true)}
          className="text-xs px-4 py-1.5 rounded font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          Write Summary
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button
          onClick={() => setEditing(true)}
          className="text-xs px-3 py-1 rounded text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-500 transition-colors"
        >
          Edit
        </button>
      </div>
      <ReadOnlyRenderer summaryJson={summaryJson} />
    </div>
  )
}
