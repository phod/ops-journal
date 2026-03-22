import type { ToolFolder } from '@shared/ipc-types'
import { buildToolTree, type TreeNode } from '../utils/buildToolTree'

interface Props {
  folders: ToolFolder[]
  selectedFolderId: string | null
  onSelect: (id: string | null) => void
}

export function FolderTreePicker({ folders, selectedFolderId, onSelect }: Props) {
  const tree = buildToolTree([], folders)

  function renderFolders(nodes: TreeNode[]): React.ReactNode {
    return nodes.map((node) => {
      if (node.type !== 'folder') return null
      const isSelected = selectedFolderId === node.folder.id
      return (
        <div key={node.folder.id}>
          <button
            type="button"
            onClick={() => onSelect(node.folder.id)}
            className={`w-full text-left px-2 py-1 text-xs rounded transition-colors flex items-center gap-1.5
              ${isSelected ? 'bg-indigo-600/30 text-indigo-200' : 'text-gray-300 hover:bg-gray-700/60'}`}
            style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
          >
            <span className="text-[10px] text-yellow-500/80 flex-shrink-0">
              {isSelected ? '📂' : '📁'}
            </span>
            <span className="truncate">{node.folder.name}</span>
            {isSelected && <span className="ml-auto text-indigo-400 flex-shrink-0">✓</span>}
          </button>
          {node.children && renderFolders(node.children)}
        </div>
      )
    })
  }

  return (
    <div className="max-h-[180px] overflow-y-auto border border-gray-700/60 rounded-lg bg-gray-800/40">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`w-full text-left px-2 py-1 text-xs rounded transition-colors flex items-center gap-1.5
          ${selectedFolderId === null ? 'bg-indigo-600/30 text-indigo-200' : 'text-gray-400 hover:bg-gray-700/60'}`}
      >
        <span className="text-[10px] flex-shrink-0">—</span>
        <span>No folder</span>
        {selectedFolderId === null && <span className="ml-auto text-indigo-400 flex-shrink-0">✓</span>}
      </button>
      {renderFolders(tree)}
    </div>
  )
}
