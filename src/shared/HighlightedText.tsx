import React from 'react'

interface Props {
  text: string
  searchTerm: string
  className?: string
}

export function HighlightedText({ text, searchTerm, className }: Props): JSX.Element {
  if (!searchTerm) {
    return <span className={className}>{text}</span>
  }

  const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)

  return (
    <span className={className}>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-amber-400/40 text-inherit rounded-sm px-0.5">{part}</mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </span>
  )
}
