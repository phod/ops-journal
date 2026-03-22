import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
  const [selectedToolIds, setSelectedToolIds] = useState<Set<string>>(new Set())
  const lastClickedToolIdRef = useRef<string | null>(null)
  const [dropIndicator, setDropIndicator] = useState<{ folderId: string | null; index: number } | null>(null)
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null)
  const [rootDropActive, setRootDropActive] = useState(false)

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

  const tree = buildToolTree(tools, folders)

  // Flat list of visible tool IDs in render order (for shift-click range selection)
  const flatToolIds = useMemo(() => {
    const ids: string[] = []
    function walk(nodes: TreeNode[]) {
      for (const node of nodes) {
        if (node.type === 'tool') {
          ids.push(node.tool.id)
        } else {
          if (expandedFolders.has(node.folder.id)) {
            walk(node.children)
          }
        }
      }
    }
    walk(tree)
    return ids
  }, [tree, expandedFolders])

  function handleToolClick(e: React.MouseEvent, toolId: string) {
    if (e.metaKey || e.ctrlKey) {
      setSelectedToolIds((prev) => {
        const next = new Set(prev)
        if (next.has(toolId)) next.delete(toolId)
        else next.add(toolId)
        return next
      })
      lastClickedToolIdRef.current = toolId
    } else if (e.shiftKey && lastClickedToolIdRef.current) {
      const lastIdx = flatToolIds.indexOf(lastClickedToolIdRef.current)
      const currIdx = flatToolIds.indexOf(toolId)
      if (lastIdx !== -1 && currIdx !== -1) {
        const start = Math.min(lastIdx, currIdx)
        const end = Math.max(lastIdx, currIdx)
        const range = flatToolIds.slice(start, end + 1)
        setSelectedToolIds((prev) => {
          const next = new Set(prev)
          for (const id of range) next.add(id)
          return next
        })
      }
    } else {
      setSelectedToolIds(new Set([toolId]))
      lastClickedToolIdRef.current = toolId
    }
  }

  // Escape to clear selection
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedToolIds(new Set())
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

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

  // Folder reorder handler (supports both same-parent reorder and cross-parent move)
  async function handleFolderReorderDrop(targetFolderId: string, position: 'before' | 'after') {
    if (!draggedFolderId || draggedFolderId === targetFolderId) return

    const targetFolder = folders.find((f) => f.id === targetFolderId)
    if (!targetFolder) return

    const parentId = targetFolder.parent_id
    const draggedFolder = folders.find((f) => f.id === draggedFolderId)
    if (!draggedFolder) return

    const crossParent = draggedFolder.parent_id !== parentId

    // Move to the target's parent first if crossing parents
    if (crossParent) {
      try {
        await window.electronAPI.moveToolFolderToFolder(draggedFolderId, parentId)
      } catch {
        return // depth/cycle validation failed
      }
    }

    // Build new sibling order under the target's parent
    const siblings = folders
      .filter((f) => f.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order)

    // If cross-parent, the dragged folder isn't in siblings yet — add it conceptually
    const allSiblings = crossParent
      ? [...siblings, draggedFolder]
      : siblings

    const withoutDragged = allSiblings.filter((f) => f.id !== draggedFolderId)
    const targetIdx = withoutDragged.findIndex((f) => f.id === targetFolderId)
    const insertIdx = position === 'before' ? targetIdx : targetIdx + 1

    const newOrder = [...withoutDragged]
    newOrder.splice(insertIdx, 0, draggedFolder)

    await window.electronAPI.reorderToolFoldersInParent(parentId, newOrder.map((f) => f.id))
  }

  // Drag-and-drop handlers
  function handleToolDragStart(e: React.DragEvent, toolId: string) {
    let dragIds: string[]
    if (selectedToolIds.has(toolId)) {
      dragIds = Array.from(selectedToolIds)
    } else {
      setSelectedToolIds(new Set())
      dragIds = [toolId]
    }
    e.dataTransfer.setData('application/tool-ids', JSON.stringify(dragIds))
    e.dataTransfer.effectAllowed = 'move'

    // Custom drag image for multi-drag
    if (dragIds.length > 1) {
      const badge = document.createElement('div')
      badge.textContent = `${dragIds.length} tools`
      badge.style.cssText = 'position:fixed;top:-100px;left:-100px;padding:4px 10px;background:#4f46e5;color:#fff;border-radius:6px;font-size:12px;font-weight:600;white-space:nowrap;'
      document.body.appendChild(badge)
      e.dataTransfer.setDragImage(badge, badge.offsetWidth / 2, badge.offsetHeight / 2)
      requestAnimationFrame(() => document.body.removeChild(badge))
    }
  }

  function handleFolderDragStart(e: React.DragEvent, folderId: string) {
    e.dataTransfer.setData('application/folder-id', folderId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedFolderId(folderId)
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
    setDropIndicator(null)

    const toolIdsJson = e.dataTransfer.getData('application/tool-ids')
    const folderId = e.dataTransfer.getData('application/folder-id')

    if (toolIdsJson) {
      const toolIds = JSON.parse(toolIdsJson) as string[]
      const toMove = toolIds.filter((id) => {
        const tool = tools.find((t) => t.id === id)
        return tool && tool.folder_id !== targetFolderId
      })
      if (toMove.length > 0) {
        await window.electronAPI.moveToolsToFolder(toMove, targetFolderId)
      }
      setSelectedToolIds(new Set())
    } else if (folderId && folderId !== targetFolderId) {
      try {
        await window.electronAPI.moveToolFolderToFolder(folderId, targetFolderId)
      } catch {
        // Depth validation or cycle detection failed — silently ignore
      }
    }

    setDraggedFolderId(null)
  }

  function handleToolDragOver(e: React.DragEvent, toolId: string, folderId: string | null) {
    if (!e.dataTransfer.types.includes('application/tool-ids')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const folderTools = tools.filter((t) => t.folder_id === folderId).sort((a, b) => a.sort_order - b.sort_order)
    const toolIndex = folderTools.findIndex((t) => t.id === toolId)
    const insertIndex = e.clientY < midY ? toolIndex : toolIndex + 1
    setDropIndicator({ folderId, index: insertIndex })
  }

  function handleToolDragLeave() {
    setDropIndicator(null)
  }

  async function handleDropOnTool(e: React.DragEvent, targetToolId: string, targetFolderId: string | null) {
    e.preventDefault()
    e.stopPropagation()
    setDropIndicator(null)

    const toolIdsJson = e.dataTransfer.getData('application/tool-ids')
    if (!toolIdsJson) return

    const dragIds = JSON.parse(toolIdsJson) as string[]
    const folderTools = tools.filter((t) => t.folder_id === targetFolderId).sort((a, b) => a.sort_order - b.sort_order)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const targetIndex = folderTools.findIndex((t) => t.id === targetToolId)
    const insertIndex = e.clientY < midY ? targetIndex : targetIndex + 1

    // Move cross-folder tools first
    const crossFolderIds = dragIds.filter((id) => {
      const tool = tools.find((t) => t.id === id)
      return tool && tool.folder_id !== targetFolderId
    })
    if (crossFolderIds.length > 0) {
      await window.electronAPI.moveToolsToFolder(crossFolderIds, targetFolderId)
    }

    // Build new ordering: existing tools minus dragged, then insert dragged at position
    const dragSet = new Set(dragIds)
    const remaining = folderTools.filter((t) => !dragSet.has(t.id)).map((t) => t.id)
    // Also include any tools that were just moved cross-folder
    const allDragInFolder = dragIds.filter((id) => {
      const tool = tools.find((t) => t.id === id)
      return tool // all are now in target folder after the move above
    })
    // Compute actual insert position in the remaining array
    let actualInsert = insertIndex
    // Adjust for removed items before the insert point
    let removed = 0
    for (let i = 0; i < insertIndex && i < folderTools.length; i++) {
      if (dragSet.has(folderTools[i].id)) removed++
    }
    actualInsert = insertIndex - removed
    if (actualInsert > remaining.length) actualInsert = remaining.length

    const newOrder = [...remaining]
    newOrder.splice(actualInsert, 0, ...allDragInFolder)
    await window.electronAPI.reorderToolsInFolder(targetFolderId, newOrder)
    setSelectedToolIds(new Set())
  }

  async function handleMoveToolToFolder(toolId: string, folderId: string | null) {
    await window.electronAPI.moveToolToFolder(toolId, folderId)
  }

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
            onReorderDrop={(position) => handleFolderReorderDrop(folderNode.folder.id, position)}
          >
            {renderTree(folderNode.children)}
          </FolderRow>
        )
      } else {
        const folderTools = tools.filter((t) => t.folder_id === node.tool.folder_id).sort((a, b) => a.sort_order - b.sort_order)
        const toolIndex = folderTools.findIndex((t) => t.id === node.tool.id)
        const showDropBefore = dropIndicator?.folderId === node.tool.folder_id && dropIndicator?.index === toolIndex
        const showDropAfter = dropIndicator?.folderId === node.tool.folder_id && dropIndicator?.index === toolIndex + 1 &&
          toolIndex === folderTools.length - 1
        return (
          <ToolCard
            key={node.tool.id}
            tool={node.tool}
            depth={node.depth}
            folders={folders}
            isSelected={selectedToolIds.has(node.tool.id)}
            onClick={(e) => handleToolClick(e, node.tool.id)}
            onEdit={() => handleEdit(node.tool)}
            onDelete={() => handleDelete(node.tool)}
            onMoveToFolder={(folderId) => handleMoveToolToFolder(node.tool.id, folderId)}
            onDragStart={(e) => handleToolDragStart(e, node.tool.id)}
            onDragOver={(e) => handleToolDragOver(e, node.tool.id, node.tool.folder_id)}
            onDragLeave={handleToolDragLeave}
            onDrop={(e) => handleDropOnTool(e, node.tool.id, node.tool.folder_id)}
            dropPosition={showDropBefore ? 'before' : showDropAfter ? 'after' : undefined}
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
              onDragEnd={() => { setDropIndicator(null); setDraggedFolderId(null) }}
            >
              {renderTree(tree)}

              {/* Root drop zone for unnesting folders */}
              {draggedFolderId && (
                <div
                  className={`mt-2 border-2 border-dashed rounded-lg py-3 text-center text-xs transition-colors ${
                    rootDropActive
                      ? 'border-indigo-500/60 bg-indigo-500/10 text-indigo-300'
                      : 'border-gray-700/60 text-gray-600'
                  }`}
                  onDragEnter={(e) => {
                    e.preventDefault()
                    if (e.dataTransfer.types.includes('application/folder-id')) {
                      setRootDropActive(true)
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                  }}
                  onDragLeave={() => setRootDropActive(false)}
                  onDrop={(e) => {
                    setRootDropActive(false)
                    handleDropOnFolder(e, null)
                  }}
                >
                  Drop here to move to root
                </div>
              )}
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
