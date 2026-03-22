import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect } from 'vitest'
import { LinkedText } from '../LinkedText'

describe('LinkedText', () => {
  it('renders plain text without links', () => {
    render(<LinkedText text="just some text" />)
    expect(screen.getByText('just some text')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('renders a URL as a clickable link', () => {
    render(<LinkedText text="visit https://example.com for info" />)
    const link = screen.getByRole('link')
    expect(link).toHaveTextContent('https://example.com')
    expect(screen.getByText(/visit/)).toBeInTheDocument()
    expect(screen.getByText(/for info/)).toBeInTheDocument()
  })

  it('renders multiple URLs', () => {
    render(<LinkedText text="see https://a.com and https://b.com" />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveTextContent('https://a.com')
    expect(links[1]).toHaveTextContent('https://b.com')
  })

  it('calls openExternal on link click', async () => {
    const user = userEvent.setup()
    render(<LinkedText text="click https://example.com here" />)
    const link = screen.getByRole('link')
    await user.click(link)
    expect(window.electronAPI.openExternal).toHaveBeenCalledWith('https://example.com')
  })

  it('applies search term highlighting within links and text', () => {
    const { container } = render(<LinkedText text="visit https://example.com now" searchTerm="example" />)
    const marks = container.querySelectorAll('mark')
    expect(marks.length).toBeGreaterThanOrEqual(1)
    expect(marks[0]).toHaveTextContent('example')
  })

  it('handles text that is only a URL', () => {
    render(<LinkedText text="https://solo.url/path" />)
    const link = screen.getByRole('link')
    expect(link).toHaveTextContent('https://solo.url/path')
  })

  it('handles http URLs', () => {
    render(<LinkedText text="go to http://insecure.example.com" />)
    const link = screen.getByRole('link')
    expect(link).toHaveTextContent('http://insecure.example.com')
  })
})
