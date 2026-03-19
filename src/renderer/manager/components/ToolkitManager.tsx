import { useState, useEffect, useCallback } from 'react'
import type { Tool } from '@shared/ipc-types'
import { ToolCard } from './ToolCard'
import { ToolForm } from './ToolForm'

export function ToolkitManager() {
  const [tools, setTools] = useState<Tool[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingTool, setEditingTool] = useState<Tool | null>(null)

  const loadTools = useCallback(async () => {
    const list = await window.electronAPI.listTools()
    setTools(list)
  }, [])

  useEffect(() => {
    loadTools()
  }, [loadTools])

  useEffect(() => {
    return window.electronAPI.onToolsChanged((updatedTools) => {
      setTools(updatedTools)
    })
  }, [])

  function handleEdit(tool: Tool) {
    setEditingTool(tool)
    setShowForm(true)
  }

  async function handleDelete(tool: Tool) {
    await window.electronAPI.deleteTool(tool.id)
  }

  function handleCloseForm() {
    setShowForm(false)
    setEditingTool(null)
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-gray-200 font-semibold text-sm">Your Tools</h2>
        <button
          onClick={() => { setEditingTool(null); setShowForm(true) }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
            bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          <span className="text-sm leading-none">+</span>
          New Tool
        </button>
      </div>

      {tools.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-600 text-sm mb-2">No tools yet</div>
          <div className="text-gray-500 text-xs">Add links and strings to access them instantly via the toolkit overlay.</div>
        </div>
      ) : (
        <div className="grid gap-3">
          {tools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              onEdit={() => handleEdit(tool)}
              onDelete={() => handleDelete(tool)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ToolForm
          tool={editingTool}
          onClose={handleCloseForm}
        />
      )}
    </>
  )
}
