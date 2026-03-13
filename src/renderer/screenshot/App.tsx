import { useEffect, useState } from 'react'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

const MIN_SELECTION_SIZE = 4

function getSelectionRect(start: { x: number; y: number }, end: { x: number; y: number }): Rect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  }
}

export function App(): JSX.Element {
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const cleanup = window.electronAPI.onScreenshotData((dataUrl) => {
      setBackgroundUrl(dataUrl)
    })

    function onKeyDown(e: KeyboardEvent): void {
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

  function handleMouseDown(e: React.MouseEvent): void {
    e.preventDefault()
    const pos = { x: e.clientX, y: e.clientY }
    setStartPos(pos)
    setCurrentPos(pos)
    setDragging(true)
  }

  function handleMouseMove(e: React.MouseEvent): void {
    if (!dragging) return
    setCurrentPos({ x: e.clientX, y: e.clientY })
  }

  function handleMouseUp(): void {
    if (!dragging) return
    setDragging(false)

    const rect = getSelectionRect(startPos, currentPos)
    const isTooSmall = rect.width < MIN_SELECTION_SIZE || rect.height < MIN_SELECTION_SIZE
    window.electronAPI.sendScreenshotSelection(isTooSmall ? null : rect)
  }

  const sel = dragging ? getSelectionRect(startPos, currentPos) : null

  return (
    <div
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
      {backgroundUrl && (
        <img
          src={backgroundUrl}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'fill',
            pointerEvents: 'none'
          }}
          draggable={false}
        />
      )}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          pointerEvents: 'none'
        }}
      />

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
