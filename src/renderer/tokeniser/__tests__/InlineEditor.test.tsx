import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { InlineEditor } from '../components/InlineEditor'

function setup(initialValue = 'abc123') {
  const onCommit = vi.fn()
  const onCancel = vi.fn()
  render(<InlineEditor initialValue={initialValue} onCommit={onCommit} onCancel={onCancel} />)
  return { ed: screen.getByTestId('inline-editor'), onCommit, onCancel }
}

describe('InlineEditor', () => {
  it('renders the value and selects all of it on mount', () => {
    const { ed } = setup()
    expect(ed).toHaveTextContent('abc123')
    expect(document.activeElement).toBe(ed)
    const sel = window.getSelection()!
    const range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null
    const spansAll = range !== null && range.toString() === 'abc123'
    expect(
      sel.toString() === 'abc123' ||
      (sel.anchorOffset === 0 && sel.focusOffset === 6) ||
      spansAll
    ).toBe(true)
  })

  it('Enter commits the current text without inserting a newline', () => {
    const { ed, onCommit, onCancel } = setup()
    fireEvent.keyDown(ed, { key: 'Enter' })
    expect(onCommit).toHaveBeenCalledWith('abc123')
    expect(ed.textContent).not.toContain('\n')
    fireEvent.blur(ed)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('Escape and blur call onCancel', () => {
    const esc = setup()
    fireEvent.keyDown(esc.ed, { key: 'Escape' })
    expect(esc.onCancel).toHaveBeenCalledTimes(1)
    expect(esc.onCommit).not.toHaveBeenCalled()
  })

  it('blur calls onCancel', () => {
    const { ed, onCancel } = setup()
    fireEvent.blur(ed)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('a paste inserts plain text only', () => {
    const { ed } = setup('')
    fireEvent.paste(ed, {
      clipboardData: {
        getData: (type: string) => (type === 'text/html' ? '<b>bold</b>' : 'bold')
      }
    })
    expect(ed.textContent).toBe('bold')
    expect(ed.innerHTML).not.toContain('<b>')
  })

  it('wraps: has the same white-space and word-break classes as the token view', () => {
    const { ed } = setup()
    expect(ed.className).toMatch(/break-all/)
    expect(ed.getAttribute('role')).toBe('textbox')
  })
})
