import React, { useEffect, useState } from 'react'
import type { JournalEntry } from '../../../../shared/ipc-types'

interface Props {
  entries: JournalEntry[]
}

function formatAbsoluteTimestamp(isoString: string): string {
  try {
    const normalized = isoString.endsWith('Z') ? isoString : isoString + 'Z'
    return new Date(normalized).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return isoString
  }
}

function DetailsEntryRow({ entry }: { entry: JournalEntry }) {
  const [imageDataUrls, setImageDataUrls] = useState<Record<string, string>>({})
  const [expandedPath, setExpandedPath] = useState<string | null>(null)

  useEffect(() => {
    for (const path of entry.image_paths) {
      if (!imageDataUrls[path]) {
        window.electronAPI.getEntryImage(path).then((dataUrl) => {
          setImageDataUrls((prev) => ({ ...prev, [path]: dataUrl }))
        }).catch(() => {})
      }
    }
  }, [entry.image_paths])

  return (
    <div className="bg-gray-800/60 rounded-lg px-4 py-3 border border-gray-700/50">
      <div className="text-xs text-gray-500 font-mono mb-1.5">
        {formatAbsoluteTimestamp(entry.created_at)}
      </div>
      {entry.body && (
        <div className="text-gray-100 text-sm font-mono whitespace-pre-wrap break-words leading-relaxed">
          {entry.body}
        </div>
      )}
      {entry.image_paths.length > 0 && (
        <div className={`flex flex-wrap gap-1.5 ${entry.body ? 'mt-1.5' : ''}`}>
          {entry.image_paths.map((path) => (
            <img
              key={path}
              src={imageDataUrls[path]}
              alt="Attached"
              onClick={() => setExpandedPath(expandedPath === path ? null : path)}
              className={`rounded border border-gray-600 object-contain cursor-pointer transition-all ${
                expandedPath === path ? 'max-h-none w-full' : 'max-h-40'
              }`}
              title={expandedPath === path ? 'Click to collapse' : 'Click to expand'}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function DetailsEntryList({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500 text-sm font-mono">
        No entries yet.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <DetailsEntryRow key={entry.id} entry={entry} />
      ))}
    </div>
  )
}
