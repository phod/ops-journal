import React from 'react'
import type { Tool } from '@shared/ipc-types'

interface Props {
  tool: Tool
  search: string
  selected: boolean
  onClick: () => void
  onMouseEnter: () => void
}

function highlightMatch(text: string, query: string) {
  if (!query) return <>{text}</>
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return <>{text}</>

  // Build a regex that matches any of the terms
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(regex)

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="text-indigo-300 font-semibold">{part}</span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  )
}

export function ToolRow({ tool, search, selected, onClick, onMouseEnter }: Props) {
  return (
    <button
      className={`no-drag w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer
        ${selected ? 'bg-indigo-600/30 border border-indigo-500/40' : 'border border-transparent hover:bg-gray-800/50'}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      {/* Type icon */}
      <span className="flex-shrink-0 w-6 h-6 rounded-md bg-gray-800 border border-gray-700 flex items-center justify-center text-xs">
        {tool.tool_type === 'link' ? (
          <span className="text-blue-400">↗</span>
        ) : (
          <span className="text-amber-400">⌨</span>
        )}
      </span>

      {/* Name + tags */}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-100 truncate">
          {highlightMatch(tool.name, search)}
        </div>
        {tool.tags.length > 0 && (
          <div className="text-[10px] text-gray-500 truncate mt-0.5">
            {tool.tags.map((tag, i) => (
              <React.Fragment key={i}>
                {i > 0 && ', '}
                {highlightMatch(tag, search)}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Type label */}
      <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded
        ${tool.tool_type === 'link'
          ? 'bg-blue-900/40 text-blue-400 border border-blue-800/40'
          : 'bg-amber-900/30 text-amber-400 border border-amber-800/40'
        }`}
      >
        {tool.tool_type}
      </span>
    </button>
  )
}
