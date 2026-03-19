import type { Tool, ToolFolder } from '@shared/ipc-types'

export interface TreeFolder {
  type: 'folder'
  folder: ToolFolder
  children: TreeNode[]
  toolCount: number
  depth: number
}

export interface TreeTool {
  type: 'tool'
  tool: Tool
  depth: number
}

export type TreeNode = TreeFolder | TreeTool

export function buildToolTree(tools: Tool[], folders: ToolFolder[]): TreeNode[] {
  const folderMap = new Map<string, ToolFolder>()
  for (const f of folders) folderMap.set(f.id, f)

  // Group folders by parent_id
  const childFolders = new Map<string | null, ToolFolder[]>()
  for (const f of folders) {
    const key = f.parent_id
    if (!childFolders.has(key)) childFolders.set(key, [])
    childFolders.get(key)!.push(f)
  }

  // Group tools by folder_id
  const toolsByFolder = new Map<string | null, Tool[]>()
  for (const t of tools) {
    const key = t.folder_id
    if (!toolsByFolder.has(key)) toolsByFolder.set(key, [])
    toolsByFolder.get(key)!.push(t)
  }

  function buildLevel(parentId: string | null, depth: number): TreeNode[] {
    const nodes: TreeNode[] = []

    // Folders first, sorted by sort_order
    const subFolders = (childFolders.get(parentId) ?? []).sort((a, b) => a.sort_order - b.sort_order)
    for (const folder of subFolders) {
      const children = buildLevel(folder.id, depth + 1)
      const toolCount = countTools(children)
      nodes.push({ type: 'folder', folder, children, toolCount, depth })
    }

    // Then tools, sorted by sort_order
    const folderTools = (toolsByFolder.get(parentId) ?? []).sort((a, b) => a.sort_order - b.sort_order)
    for (const tool of folderTools) {
      nodes.push({ type: 'tool', tool, depth })
    }

    return nodes
  }

  return buildLevel(null, 0)
}

function countTools(nodes: TreeNode[]): number {
  let count = 0
  for (const node of nodes) {
    if (node.type === 'tool') count++
    else count += node.toolCount
  }
  return count
}
