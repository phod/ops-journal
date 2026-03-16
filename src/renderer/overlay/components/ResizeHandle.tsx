import React, { useCallback } from 'react'

interface Props {
  onResize: (delta: number) => void
}

export function ResizeHandle({ onResize }: Props) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      let lastX = e.clientX

      const onMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - lastX
        lastX = e.clientX
        onResize(delta)
      }

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [onResize]
  )

  return (
    <div
      onMouseDown={handleMouseDown}
      className="w-1 flex-shrink-0 cursor-col-resize hover:bg-gray-500/40 active:bg-gray-400/50 transition-colors"
    />
  )
}
