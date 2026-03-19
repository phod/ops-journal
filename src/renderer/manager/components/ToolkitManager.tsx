import { useState, useEffect, useCallback } from 'react'
import type { Tool, ToolFolder } from '@shared/ipc-types'
import { ToolCard } from './ToolCard'
import { ToolForm } from './ToolForm'
import { BulkToolForm } from './BulkToolForm'
import { ConversionQueue } from './ConversionQueue'
import { FolderRow } from './FolderRow'
import { buildToolTree, type TreeNode, type TreeFolder } from '../utils/buildToolTree'

type SubTab = 'tools' | 'from-entries'

const EXPANDED_FOLDERS_KEY = 'ops-journal:expandedToolFolders'

function loadExpandedFolders(): Set<string> {
  try {
    const stored = localStorage.getItem(EXPANDED_FOLDERS_KEY)
    if (stored) return new Set(JSON.parse(stored))
  } catch { /* ignore */ }
  return new Set()
}

function saveExpandedFolders(set: Set<string>) {
  localStorage.setItem(EXPANDED_FOLDERS_KEY, JSON.stringify([...set]))
}

export function ToolkitManager() {
  const [tools, setTools] = useState<Tool[]>([])
  const [folders, setFolders] = useState<ToolFolder[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(loadExpandedFolders)
  const [showForm, setShowForm] = useState(false)
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [editingTool, setEditingTool] = useState<Tool | null>(null)
  const [formFolderId, setFormFolderId] = useState<string | null>(null)
  const [subTab, setSubTab] = useState<SubTab>('tools')
  const [pendingCount, setPendingCount] = useState(0)

  const loadTools = useCallback(async () => {
    const list = await window.electronAPI.listTools()
    setTools(list)
  }, [])

  const loadFolders = useCallback(async () => {
    const list = await window.electronAPI.listToolFolders()
    setFolders(list)
  }, [])

  const loadPendingCount = useCallback(async () => {
    const entries = await window.electronAPI.listPendingToolEntries()
    setPendingCount(entries.length)
  }, [])

  useEffect(() => {
    loadTools()
    loadFolders()
    loadPendingCount()
  }, [loadTools, loadFolders, loadPendingCount])

  useEffect(() => {
    return window.electronAPI.onToolsChanged((updatedTools) => {
      setTools(updatedTools)
    })
  }, [])

  useEffect(() => {
    return window.electronAPI.onToolFoldersChanged((updatedFolders) => {
      setFolders(updatedFolders)
    })
  }, [])

  useEffect(() => {
    return window.electronAPI.onEntriesChanged(() => {
      loadPendingCount()
    })
  }, [loadPendingCount])

  function toggleFolder(folderId: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      saveExpandedFolders(next)
      return next
    })
  }

  function handleEdit(tool: Tool) {
    setEditingTool(tool)
    setFormFolderId(tool.folder_id)
    setShowForm(true)
  }

  async function handleDelete(tool: Tool) {
    await window.electronAPI.deleteTool(tool.id)
  }

  function handleCloseForm() {
    setShowForm(false)
    setEditingTool(null)
    setFormFolderId(null)
  }

  function openNewToolForm(folderId: string | null = null) {
    setEditingTool(null)
    setFormFolderId(folderId)
    setShowForm(true)
  }

  async function handleCreateFolder(parentId: string | null = null) {
    await window.electronAPI.createToolFolder('New Folder', parentId)
  }

  async function handleRenameFolder(id: string, name: string) {
    await window.electronAPI.renameToolFolder(id, name)
  }

  async function handleDeleteFolder(id: string) {
    await window.electronAPI.deleteToolFolder(id)
  }

  // Drag-and-drop handlers
  function handleToolDragStart(e: React.DragEvent, toolId: string) {
    e.dataTransfer.setData('application/tool-id', toolId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleFolderDragStart(e: React.DragEvent, folderId: string) {
    e.dataTransfer.setData('application/folder-id', folderId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleFolderDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleFolderDragLeave(_e: React.DragEvent) {
    // visual state handled in FolderRow
  }

  async function handleDropOnFolder(e: React.DragEvent, targetFolderId: string | null) {
    e.preventDefault()
    e.stopPropagation()

    const toolId = e.dataTransfer.getData('application/tool-id')
    const folderId = e.dataTransfer.getData('application/folder-id')

    if (toolId) {
      await window.electronAPI.moveToolToFolder(toolId, targetFolderId)
    } else if (folderId && folderId !== targetFolderId) {
      try {
        await window.electronAPI.moveToolFolderToFolder(folderId, targetFolderId)
      } catch {
        // Depth validation or cycle detection failed — silently ignore
      }
    }
  }

  async function handleMoveToolToFolder(toolId: string, folderId: string | null) {
    await window.electronAPI.moveToolToFolder(toolId, folderId)
  }

  const tree = buildToolTree(tools, folders)

  function renderTree(nodes: TreeNode[]): React.ReactNode {
    return nodes.map((node) => {
      if (node.type === 'folder') {
        const folderNode = node as TreeFolder
        const isExpanded = expandedFolders.has(folderNode.folder.id)
        return (
          <FolderRow
            key={folderNode.folder.id}
            folder={folderNode.folder}
            depth={folderNode.depth}
            toolCount={folderNode.toolCount}
            expanded={isExpanded}
            onToggle={() => toggleFolder(folderNode.folder.id)}
            onRename={(name) => handleRenameFolder(folderNode.folder.id, name)}
            onDelete={() => handleDeleteFolder(folderNode.folder.id)}
            onAddTool={() => openNewToolForm(folderNode.folder.id)}
            onAddSubFolder={() => handleCreateFolder(folderNode.folder.id)}
            onDragStart={(e) => handleFolderDragStart(e, folderNode.folder.id)}
            onDragOver={handleFolderDragOver}
            onDrop={(e) => handleDropOnFolder(e, folderNode.folder.id)}
            onDragLeave={handleFolderDragLeave}
          >
            {renderTree(folderNode.children)}
          </FolderRow>
        )
      } else {
        return (
          <ToolCard
            key={node.tool.id}
            tool={node.tool}
            depth={node.depth}
            folders={folders}
            onEdit={() => handleEdit(node.tool)}
            onDelete={() => handleDelete(node.tool)}
            onMoveToFolder={(folderId) => handleMoveToolToFolder(node.tool.id, folderId)}
            onDragStart={(e) => handleToolDragStart(e, node.tool.id)}
          />
        )
      }
    })
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
                onClick={() => handleCreateFolder(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                  bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
              >
                <span className="text-sm leading-none">+</span>
                Folder
              </button>
              <button
                onClick={() => setShowBulkForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                  bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
              >
                Bulk Create
              </button>
              <button
                onClick={() => openNewToolForm(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                  bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                <span className="text-sm leading-none">+</span>
                New Tool
              </button>
            </div>
          </div>

          {tools.length === 0 && folders.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-600 text-sm mb-2">No tools yet</div>
              <div className="text-gray-500 text-xs">Add links and strings to access them instantly via the toolkit overlay.</div>
            </div>
          ) : (
            <div
              className="grid gap-0.5"
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
              onDrop={(e) => handleDropOnFolder(e, null)}
            >
              {renderTree(tree)}
            </div>
          )}

          {showForm && (
            <ToolForm
              tool={editingTool}
              folderId={formFolderId}
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
