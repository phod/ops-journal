import React from 'react'
import { HighlightedText } from './HighlightedText'

interface Props {
  text: string
  searchTerm?: string
  className?: string
}

const URL_REGEX = /https?:\/\/[^\s<>'")\]},]+/g

function handleLinkClick(e: React.MouseEvent, url: string): void {
  e.preventDefault()
  e.stopPropagation()
  window.electronAPI.openExternal(url)
}

function preventDrag(e: React.DragEvent): void {
  e.preventDefault()
  e.stopPropagation()
}

export function LinkedText({ text, searchTerm, className }: Props): JSX.Element {
  const parts: { text: string; isUrl: boolean }[] = []
  let lastIndex = 0

  for (const match of text.matchAll(URL_REGEX)) {
    const url = match[0]
    const start = match.index!
    if (start > lastIndex) {
      parts.push({ text: text.slice(lastIndex, start), isUrl: false })
    }
    parts.push({ text: url, isUrl: true })
    lastIndex = start + url.length
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isUrl: false })
  }

  // No URLs found — fast path
  if (parts.length === 1 && !parts[0].isUrl) {
    if (searchTerm) return <HighlightedText text={text} searchTerm={searchTerm} className={className} />
    return <span className={className}>{text}</span>
  }

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.isUrl ? (
          <span
            key={i}
            role="link"
            onClick={(e) => handleLinkClick(e, part.text)}
            onDragStart={preventDrag}
            draggable={false}
            className="text-blue-400 underline hover:text-blue-300 cursor-pointer"
            data-tooltip={part.text}
          >
            {searchTerm ? <HighlightedText text={part.text} searchTerm={searchTerm} /> : part.text}
          </span>
        ) : searchTerm ? (
          <HighlightedText key={i} text={part.text} searchTerm={searchTerm} />
        ) : (
          <React.Fragment key={i}>{part.text}</React.Fragment>
        )
      )}
    </span>
  )
}
