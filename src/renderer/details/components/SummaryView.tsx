import { useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { SummaryEditor } from './SummaryEditor'

interface Props {
  investigationId: string
}

function ReadOnlyRenderer({ summaryJson }: { summaryJson: string }) {
  const editor = useEditor({
    extensions: [StarterKit],
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
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setLoading(true)
    window.electronAPI.getSummary(investigationId).then((json) => {
      setSummaryJson(json)
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
      <SummaryEditor
        investigationId={investigationId}
        initialJson={summaryJson}
        onSave={(json) => {
          setSummaryJson(json)
          setEditing(false)
        }}
        onCancel={() => setEditing(false)}
      />
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
