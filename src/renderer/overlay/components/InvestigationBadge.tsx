import React from 'react'
import type { Investigation } from '../../../../shared/ipc-types'

interface Props {
  investigation: Investigation
}

export function InvestigationBadge({ investigation }: Props) {
  const handleClick = () => {
    window.electronAPI.openManager()
  }

  return (
    <button
      onClick={handleClick}
      className="no-drag flex items-center gap-2 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 transition-colors text-white text-sm font-medium truncate max-w-full"
      title={`Active: ${investigation.name} — Click to manage`}
    >
      <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
      <span className="truncate">{investigation.name}</span>
      <span className="text-indigo-300 text-xs flex-shrink-0 ml-1">↗</span>
    </button>
  )
}
