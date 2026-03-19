import { useState, useEffect, useCallback } from 'react'
import type { Tool } from '@shared/ipc-types'
import { ToolCard } from './ToolCard'
import { ToolForm } from './ToolForm'
import { BulkToolForm } from './BulkToolForm'
import { ConversionQueue } from './ConversionQueue'

type SubTab = 'tools' | 'from-entries'

export function ToolkitManager() {
  const [tools, setTools] = useState<Tool[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [editingTool, setEditingTool] = useState<Tool | null>(null)
  const [subTab, setSubTab] = useState<SubTab>('tools')
  const [pendingCount, setPendingCount] = useState(0)

  const loadTools = useCallback(async () => {
    const list = await window.electronAPI.listTools()
    setTools(list)
  }, [])

  const loadPendingCount = useCallback(async () => {
    const entries = await window.electronAPI.listPendingToolEntries()
    setPendingCount(entries.length)
  }, [])

  useEffect(() => {
    loadTools()
    loadPendingCount()
  }, [loadTools, loadPendingCount])

  useEffect(() => {
    return window.electronAPI.onToolsChanged((updatedTools) => {
      setTools(updatedTools)
    })
  }, [])

  useEffect(() => {
    return window.electronAPI.onEntriesChanged(() => {
      loadPendingCount()
    })
  }, [loadPendingCount])

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
      {/* Sub-tab bar */}
      <div className="flex items-center gap-6 mb-4 border-b border-gray-800 pb-3">
        <button
          onClick={() => setSubTab('tools')}
          className={`text-sm font-medium pb-1 transition-colors ${
            subTab === 'tools'
              ? 'text-sky-400 border-b-2 border-sky-400'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Your Tools
        </button>
        <button
          onClick={() => setSubTab('from-entries')}
          className={`text-sm font-medium pb-1 transition-colors flex items-center gap-2 ${
            subTab === 'from-entries'
              ? 'text-sky-400 border-b-2 border-sky-400'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Create from Entries
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-sky-500/20 text-sky-300">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {subTab === 'tools' ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-gray-200 font-semibold text-sm">Your Tools</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBulkForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                  bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
              >
                Bulk Create
              </button>
              <button
                onClick={() => { setEditingTool(null); setShowForm(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                  bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                <span className="text-sm leading-none">+</span>
                New Tool
              </button>
            </div>
          </div>

          {tools.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-600 text-sm mb-2">No tools yet</div>
              <div className="text-gray-500 text-xs">Add links and strings to access them instantly via the toolkit overlay.</div>
            </div>
          ) : (
            <div className="grid gap-1.5">
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

          {showBulkForm && (
            <BulkToolForm onClose={() => setShowBulkForm(false)} />
          )}
        </>
      ) : (
        <ConversionQueue />
      )}
    </>
  )
}
