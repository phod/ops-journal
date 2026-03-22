import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { Tool, ToolFolder } from '@shared/ipc-types'
import { ToolRow } from './components/ToolRow'
import { FunctionParamDialog } from './components/FunctionParamDialog'
import { ContentViewer } from './components/ContentViewer'
import { ReferenceViewer } from './components/ReferenceViewer'
import { buildToolTree, type TreeNode } from '@renderer/manager/utils/buildToolTree'

interface FlatFolderItem {
  type: 'folder'
  folder: ToolFolder
  depth: number
  expanded: boolean
  toolCount: number
}

interface FlatToolItem {
  type: 'tool'
  tool: Tool
  depth: number
}

type FlatItem = FlatFolderItem | FlatToolItem

export default function App() {
  const [tools, setTools] = useState<Tool[]>([])
  const [folders, setFolders] = useState<ToolFolder[]>([])
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [opaqueOverlay, setOpaqueOverlay] = useState(false)
  const [functionToolPending, setFunctionToolPending] = useState<Tool | null>(null)
  const [referenceToolPending, setReferenceToolPending] = useState<Tool | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [expandedBeforeSearch, setExpandedBeforeSearch] = useState<Set<string> | null>(null)

  const loadTools = useCallback(async () => {
    const list = await window.electronAPI.listTools()
    setTools(list)
  }, [])

  const loadFolders = useCallback(async () => {
    const list = await window.electronAPI.listToolFolders()
    setFolders(list)
    // Default: all folders expanded
    setExpandedFolders(new Set(list.map((f) => f.id)))
  }, [])

  useEffect(() => {
    loadTools()
    loadFolders()
  }, [loadTools, loadFolders])

  useEffect(() => {
    window.electronAPI.getOpaqueOverlay().then(setOpaqueOverlay)
    return window.electronAPI.onOpaqueOverlayChanged(setOpaqueOverlay)
  }, [])

  useEffect(() => {
    return window.electronAPI.onToolsChanged((updatedTools) => {
      setTools(updatedTools)
    })
  }, [])

  useEffect(() => {
    return window.electronAPI.onToolFoldersChanged((updatedFolders) => {
      setFolders(updatedFolders)
      setExpandedFolders((prev) => {
        const next = new Set(prev)
        for (const f of updatedFolders) {
          if (!prev.has(f.id)) next.add(f.id)
        }
        return next
      })
    })
  }, [])

  // Auto-focus search on window focus
  useEffect(() => {
    const handleFocus = () => {
      setSearch('')
      setSelectedIndex(0)
      setFunctionToolPending(null)
      setReferenceToolPending(null)
      setExpandedBeforeSearch(null)
      // Re-expand all on focus
      setExpandedFolders(new Set(folders.map((f) => f.id)))
      searchRef.current?.focus()
    }
    window.addEventListener('focus', handleFocus)
    // Focus on mount
    searchRef.current?.focus()
    return () => window.removeEventListener('focus', handleFocus)
  }, [folders])

  const tree = useMemo(() => buildToolTree(tools, folders), [tools, folders])

  // Filter tools by search and build flat items list
  const { flatItems, filteredToolCount } = useMemo(() => {
    const isSearching = search.trim().length > 0
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean)

    function toolMatches(tool: Tool): boolean {
      if (!isSearching) return true
      const name = tool.name.toLowerCase()
      const value = tool.value.toLowerCase()
      const tags = tool.tags.map((t) => t.toLowerCase())
      return terms.every((term) =>
        name.includes(term) ||
        value.includes(term) ||
        tags.some((tag) => tag.includes(term))
      )
    }

    // When searching, find which folders contain matching tools
    function folderHasMatches(nodes: TreeNode[]): boolean {
      for (const node of nodes) {
        if (node.type === 'tool' && toolMatches(node.tool)) return true
        if (node.type === 'folder' && folderHasMatches(node.children)) return true
      }
      return false
    }

    const items: FlatItem[] = []
    let toolCount = 0

    function flattenTree(nodes: TreeNode[]) {
      for (const node of nodes) {
        if (node.type === 'folder') {
          const hasMatches = isSearching ? folderHasMatches(node.children) : true
          if (!hasMatches) continue

          const isExpanded = isSearching ? true : expandedFolders.has(node.folder.id)
          items.push({
            type: 'folder',
            folder: node.folder,
            depth: node.depth,
            expanded: isExpanded,
            toolCount: node.toolCount
          })

          if (isExpanded) {
            flattenTree(node.children)
          }
        } else {
          if (toolMatches(node.tool)) {
            items.push({ type: 'tool', tool: node.tool, depth: node.depth })
            toolCount++
          }
        }
      }
    }

    flattenTree(tree)
    return { flatItems: items, filteredToolCount: toolCount }
  }, [tree, search, expandedFolders])

  // Handle search state changes for folder expand/collapse
  useEffect(() => {
    if (search.trim()) {
      // Save expand state when search starts
      if (expandedBeforeSearch === null) {
        setExpandedBeforeSearch(new Set(expandedFolders))
      }
    } else if (expandedBeforeSearch !== null) {
      // Restore expand state when search clears
      setExpandedFolders(expandedBeforeSearch)
      setExpandedBeforeSearch(null)
    }
  }, [search])

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const selected = list.children[selectedIndex] as HTMLElement | undefined
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  function toggleFolder(folderId: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  async function executeTool(tool: Tool) {
    if (tool.tool_type === 'function') {
      setFunctionToolPending(tool)
      return
    }
    if (tool.tool_type === 'content' || tool.tool_type === 'reference') {
      setReferenceToolPending(tool)
      return
    }
    await window.electronAPI.executeTool(tool.id)
    if (tool.tool_type === 'link') {
      await window.electronAPI.hideToolkitOverlay()
    }
  }

  async function handleFunctionRun(paramValues: Record<string, string>) {
    if (!functionToolPending) return
    await window.electronAPI.executeFunctionTool(functionToolPending.id, paramValues)
    setFunctionToolPending(null)
    await window.electronAPI.hideToolkitOverlay()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (functionToolPending || referenceToolPending) return // dialog handles its own keys

    const item = flatItems[selectedIndex]

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (item?.type === 'folder' && expandedFolders.has(item.folder.id)) {
        toggleFolder(item.folder.id)
      } else if (item?.type === 'tool') {
        // Select parent folder
        const tool = item.tool
        if (tool.folder_id) {
          const parentIdx = flatItems.findIndex(
            (fi) => fi.type === 'folder' && fi.folder.id === tool.folder_id
          )
          if (parentIdx !== -1) setSelectedIndex(parentIdx)
        }
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (item?.type === 'folder' && !expandedFolders.has(item.folder.id)) {
        toggleFolder(item.folder.id)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (item?.type === 'folder') {
        toggleFolder(item.folder.id)
      } else if (item?.type === 'tool') {
        executeTool(item.tool)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      window.electronAPI.hideToolkitOverlay()
    }
  }

  const hasFolders = folders.length > 0

  // Determine action label for the selected item
  const selectedItem = flatItems[selectedIndex]
  const actionLabel = selectedItem?.type === 'folder'
    ? 'toggle'
    : selectedItem?.type === 'tool' && (selectedItem.tool.tool_type === 'content' || selectedItem.tool.tool_type === 'reference')
    ? 'open'
    : 'execute'

  // When function dialog is open, show the dialog instead of the tool list
  if (functionToolPending) {
    return (
      <div
        className={`h-screen flex flex-col rounded-xl ${opaqueOverlay ? 'bg-gray-900/95' : 'bg-gray-900'} border border-gray-700/60 shadow-2xl overflow-hidden backdrop-blur-sm`}
      >
        <FunctionParamDialog
          tool={functionToolPending}
          onRun={handleFunctionRun}
          onCancel={() => setFunctionToolPending(null)}
        />
      </div>
    )
  }

  // When content/reference viewer is open, show it instead of the tool list
  if (referenceToolPending) {
    return (
      <div
        className={`h-screen flex flex-col rounded-xl ${opaqueOverlay ? 'bg-gray-900/95' : 'bg-gray-900'} border border-gray-700/60 shadow-2xl overflow-hidden backdrop-blur-sm`}
      >
        {referenceToolPending.tool_type === 'reference' ? (
          <ReferenceViewer
            tool={referenceToolPending}
            onClose={() => setReferenceToolPending(null)}
          />
        ) : (
          <ContentViewer
            tool={referenceToolPending}
            onClose={() => setReferenceToolPending(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div
      className={`h-screen flex flex-col rounded-xl ${opaqueOverlay ? 'bg-gray-900/95' : 'bg-gray-900'} border border-gray-700/60 shadow-2xl overflow-hidden backdrop-blur-sm`}
      onKeyDown={handleKeyDown}
    >
      {/* Drag handle header */}
      <div className="drag-handle flex items-center justify-between px-4 py-2.5 border-b border-gray-800/60">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span className="text-xs font-semibold text-gray-300 tracking-wide">Toolkit</span>
        </div>
        <span className="text-[10px] text-gray-600 font-mono">{filteredToolCount} tool{filteredToolCount !== 1 ? 's' : ''}</span>
      </div>

      {/* Search bar */}
      <div className="px-3 py-2 border-b border-gray-800/40">
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tools..."
          className="no-drag w-full bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 outline-none focus:border-indigo-500/60 transition-colors"
        />
      </div>

      {/* Tool list */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-1.5 py-1.5">
        {flatItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs">
            {tools.length === 0 ? 'No tools yet — add some in the manager' : 'No matching tools'}
          </div>
        ) : (
          flatItems.map((item, i) => {
            if (item.type === 'folder') {
              return (
                <button
                  key={`folder-${item.folder.id}`}
                  className={`no-drag w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer
                    ${i === selectedIndex ? 'bg-indigo-600/20 border border-indigo-500/30' : 'border border-transparent hover:bg-gray-800/40'}`}
                  style={{ paddingLeft: `${item.depth * 16 + 12}px` }}
                  onClick={() => toggleFolder(item.folder.id)}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <span className={`text-[10px] text-gray-500 transition-transform flex-shrink-0 ${item.expanded ? 'rotate-90' : ''}`}>
                    ▶
                  </span>
                  <span className="text-xs flex-shrink-0">
                    {item.expanded ? '📂' : '📁'}
                  </span>
                  <span className="text-xs text-gray-400 font-semibold tracking-wider uppercase truncate">
                    {item.folder.name}
                  </span>
                  <span className="text-[10px] text-gray-600 flex-shrink-0">
                    {item.toolCount}
                  </span>
                </button>
              )
            } else {
              return (
                <ToolRow
                  key={item.tool.id}
                  tool={item.tool}
                  search={search}
                  selected={i === selectedIndex}
                  depth={item.depth}
                  onClick={() => executeTool(item.tool)}
                  onMouseEnter={() => setSelectedIndex(i)}
                />
              )
            }
          })
        )}
      </div>

      {/* Footer hints */}
      <div className="px-3 py-1.5 border-t border-gray-800/40 flex items-center gap-3">
        <span className="text-[10px] text-gray-600">
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-500 text-[9px] font-mono">↑↓</kbd> navigate
        </span>
        <span className="text-[10px] text-gray-600">
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-500 text-[9px] font-mono">↵</kbd> {actionLabel}
        </span>
        <span className="text-[10px] text-gray-600">
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-500 text-[9px] font-mono">esc</kbd> close
        </span>
        {hasFolders && (
          <span className="text-[10px] text-gray-600">
            <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-500 text-[9px] font-mono">←→</kbd> fold/unfold
          </span>
        )}
      </div>
    </div>
  )
}
