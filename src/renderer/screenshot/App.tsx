import React, { useEffect, useRef, useState } from 'react'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export function App() {
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cleanup = window.electronAPI.onScreenshotData((dataUrl) => {
      setBackgroundUrl(dataUrl)
    })

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.electronAPI.sendScreenshotSelection(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      cleanup()
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const getSelectionRect = (): Rect => {
    const x = Math.min(startPos.x, currentPos.x)
    const y = Math.min(startPos.y, currentPos.y)
    const width = Math.abs(currentPos.x - startPos.x)
    const height = Math.abs(currentPos.y - startPos.y)
    return { x, y, width, height }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setStartPos({ x: e.clientX, y: e.clientY })
    setCurrentPos({ x: e.clientX, y: e.clientY })
    setDragging(true)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return
    setCurrentPos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!dragging) return
    setDragging(false)
    const rect = getSelectionRect()
    if (rect.width < 4 || rect.height < 4) {
      // Too small, treat as cancel
      window.electronAPI.sendScreenshotSelection(null)
      return
    }
    window.electronAPI.sendScreenshotSelection(rect)
  }

  const sel = dragging ? getSelectionRect() : null

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        position: 'fixed',
        inset: 0,
        cursor: 'crosshair',
        userSelect: 'none'
      }}
    >
      {/* Full-screen background image */}
      {backgroundUrl && (
        <img
          src={backgroundUrl}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none' }}
          draggable={false}
        />
      )}

      {/* Dark overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          pointerEvents: 'none'
        }}
      />

      {/* Selection rectangle cut-out */}
      {sel && sel.width > 0 && sel.height > 0 && (
        <div
          style={{
            position: 'absolute',
            left: sel.x,
            top: sel.y,
            width: sel.width,
            height: sel.height,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
            border: '2px solid rgba(99,102,241,0.9)',
            pointerEvents: 'none',
            boxSizing: 'border-box'
          }}
        />
      )}

      {/* Instruction hint */}
      {!dragging && (
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.7)',
            color: '#e5e7eb',
            fontFamily: 'monospace',
            fontSize: 13,
            padding: '6px 14px',
            borderRadius: 6,
            pointerEvents: 'none',
            whiteSpace: 'nowrap'
          }}
        >
          Drag to select region &nbsp;·&nbsp; Esc to cancel
        </div>
      )}
    </div>
  )
}
