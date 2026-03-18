import { describe, it, expect, vi } from 'vitest'
import type { JournalEntry } from '@shared/ipc-types'

vi.mock('../images', () => ({
  readImageAsDataUrl: vi.fn((path: string) => `data:image/png;base64,FAKE_${path}`)
}))

import { exportAsMarkdown, buildExportHtml, summaryJsonToMarkdown, summaryJsonToHtml } from '../export'

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'entry-1',
    investigation_id: 'inv-1',
    body: 'Something happened',
    image_paths: [],
    created_at: '2024-06-15T14:30:00Z',
    type: 'note',
    ...overrides
  }
}

// ---------------------------------------------------------------------------
// exportAsMarkdown
// ---------------------------------------------------------------------------

describe('exportAsMarkdown', () => {
  it('includes investigation name and created date', () => {
    const md = exportAsMarkdown('Test Outage', '2024-06-15T10:00:00Z', [])
    expect(md).toContain('# Test Outage')
    expect(md).toContain('Created:')
    expect(md).toContain('Jun')
  })

  it('renders entries with type labels and timestamps', () => {
    const entry = makeEntry({ type: 'finding', body: 'Found the root cause' })
    const md = exportAsMarkdown('Inc', '2024-06-15T10:00:00Z', [entry])
    expect(md).toContain('Finding')
    expect(md).toContain('Found the root cause')
  })

  it('renders hypothesis entries with status', () => {
    const entry = makeEntry({ type: 'hypothesis', body: 'Maybe DNS', hypothesis_status: 'true' })
    const md = exportAsMarkdown('Inc', '2024-06-15T10:00:00Z', [entry])
    expect(md).toContain('[TRUE]')
    expect(md).toContain('Maybe DNS')
  })

  it('renders flagged entries with flag marker', () => {
    const entry = makeEntry({ flagged: true, body: 'Important' })
    const md = exportAsMarkdown('Inc', '2024-06-15T10:00:00Z', [entry])
    expect(md).toContain('⚑')
  })

  it('omits images by default', () => {
    const entry = makeEntry({ image_paths: ['/path/to/screenshot.png'] })
    const md = exportAsMarkdown('Inc', '2024-06-15T10:00:00Z', [entry])
    expect(md).not.toContain('screenshot.png')
  })

  it('includes image references when imageHandling is "reference"', () => {
    const entry = makeEntry({ image_paths: ['/path/to/screenshot.png'] })
    const md = exportAsMarkdown('Inc', '2024-06-15T10:00:00Z', [entry], undefined, 'reference')
    expect(md).toContain('[image: screenshot.png]')
  })

  it('includes summary section when summaryJson is provided', () => {
    const summaryJson = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Root cause was DNS' }] }]
    })
    const md = exportAsMarkdown('Inc', '2024-06-15T10:00:00Z', [], summaryJson)
    expect(md).toContain('## Summary')
    expect(md).toContain('Root cause was DNS')
  })

  it('renders linked findings for hypothesis entries', () => {
    const hypothesis = makeEntry({
      id: 'h1',
      type: 'hypothesis',
      body: 'DNS issue',
      linked_finding_ids: ['f1'] as unknown as number[]
    })
    const finding = makeEntry({ id: 'f1', type: 'finding', body: 'DNS timeout in logs' })
    const md = exportAsMarkdown('Inc', '2024-06-15T10:00:00Z', [hypothesis, finding])
    expect(md).toContain('**Findings:**')
    expect(md).toContain('DNS timeout in logs')
  })

  it('renders child hypotheses', () => {
    const parent = makeEntry({
      id: 'h1',
      type: 'hypothesis',
      body: 'Network issue',
      linked_child_hypothesis_ids: ['h2'] as unknown as number[]
    })
    const child = makeEntry({ id: 'h2', type: 'hypothesis', body: 'DNS issue', hypothesis_status: 'open' })
    const md = exportAsMarkdown('Inc', '2024-06-15T10:00:00Z', [parent, child])
    expect(md).toContain('**Child Hypotheses:**')
    expect(md).toContain('DNS issue [OPEN]')
  })

  it('renders parent hypotheses', () => {
    const parent = makeEntry({
      id: 'h1',
      type: 'hypothesis',
      body: 'Network issue',
      hypothesis_status: 'open',
      linked_child_hypothesis_ids: ['h2'] as unknown as number[]
    })
    const child = makeEntry({ id: 'h2', type: 'hypothesis', body: 'DNS issue' })
    const md = exportAsMarkdown('Inc', '2024-06-15T10:00:00Z', [parent, child])
    expect(md).toContain('**Parent:** Network issue [OPEN]')
  })
})

// ---------------------------------------------------------------------------
// summaryJsonToMarkdown
// ---------------------------------------------------------------------------

describe('summaryJsonToMarkdown', () => {
  it('converts a simple paragraph', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }] }
    expect(summaryJsonToMarkdown(JSON.stringify(doc))).toBe('Hello world')
  })

  it('converts bold and italic marks', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' and ' },
          { type: 'text', text: 'italic', marks: [{ type: 'italic' }] }
        ]
      }]
    }
    const md = summaryJsonToMarkdown(JSON.stringify(doc))
    expect(md).toContain('**bold**')
    expect(md).toContain('_italic_')
  })

  it('converts headings', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] }]
    }
    expect(summaryJsonToMarkdown(JSON.stringify(doc))).toBe('## Title')
  })

  it('converts bullet lists', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item A' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item B' }] }] }
        ]
      }]
    }
    const md = summaryJsonToMarkdown(JSON.stringify(doc))
    expect(md).toContain('- Item A')
    expect(md).toContain('- Item B')
  })

  it('converts ordered lists', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'orderedList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }] }
        ]
      }]
    }
    const md = summaryJsonToMarkdown(JSON.stringify(doc))
    expect(md).toContain('1. First')
    expect(md).toContain('2. Second')
  })

  it('converts code blocks', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'codeBlock', attrs: { language: 'js' }, content: [{ type: 'text', text: 'const x = 1' }] }]
    }
    const md = summaryJsonToMarkdown(JSON.stringify(doc))
    expect(md).toContain('```js')
    expect(md).toContain('const x = 1')
    expect(md).toContain('```')
  })

  it('converts blockquotes', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'blockquote',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quoted text' }] }]
      }]
    }
    const md = summaryJsonToMarkdown(JSON.stringify(doc))
    expect(md).toContain('> Quoted text')
  })

  it('converts links', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'click here', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] }]
      }]
    }
    const md = summaryJsonToMarkdown(JSON.stringify(doc))
    expect(md).toContain('[click here](https://example.com)')
  })

  it('converts code marks', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'inline', marks: [{ type: 'code' }] }]
      }]
    }
    expect(summaryJsonToMarkdown(JSON.stringify(doc))).toContain('`inline`')
  })

  it('converts strikethrough marks', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'removed', marks: [{ type: 'strike' }] }]
      }]
    }
    expect(summaryJsonToMarkdown(JSON.stringify(doc))).toContain('~~removed~~')
  })

  it('converts horizontal rules', () => {
    const doc = { type: 'doc', content: [{ type: 'horizontalRule' }] }
    expect(summaryJsonToMarkdown(JSON.stringify(doc))).toContain('---')
  })

  it('returns empty string on invalid JSON', () => {
    expect(summaryJsonToMarkdown('not json')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// summaryJsonToHtml
// ---------------------------------------------------------------------------

describe('summaryJsonToHtml', () => {
  it('converts a paragraph to HTML', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] }
    const html = summaryJsonToHtml(JSON.stringify(doc))
    expect(html).toContain('<p')
    expect(html).toContain('Hello')
  })

  it('converts bold marks to strong tags', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'bold', marks: [{ type: 'bold' }] }] }]
    }
    expect(summaryJsonToHtml(JSON.stringify(doc))).toContain('<strong>bold</strong>')
  })

  it('escapes HTML entities in text', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '<script>alert("xss")</script>' }] }]
    }
    const html = summaryJsonToHtml(JSON.stringify(doc))
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })

  it('returns empty string on invalid JSON', () => {
    expect(summaryJsonToHtml('broken')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// buildExportHtml
// ---------------------------------------------------------------------------

describe('buildExportHtml', () => {
  it('produces a complete HTML document', () => {
    const html = buildExportHtml('Outage Report', '2024-06-15T10:00:00Z', [])
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Outage Report')
    expect(html).toContain('</html>')
  })

  it('includes entries with type labels', () => {
    const entry = makeEntry({ type: 'action', body: 'Restart service' })
    const html = buildExportHtml('Inc', '2024-06-15T10:00:00Z', [entry])
    expect(html).toContain('Action')
    expect(html).toContain('Restart service')
  })

  it('includes hypothesis status badges', () => {
    const entry = makeEntry({ type: 'hypothesis', body: 'DNS', hypothesis_status: 'false' })
    const html = buildExportHtml('Inc', '2024-06-15T10:00:00Z', [entry])
    expect(html).toContain('False')
  })

  it('includes flagged badge', () => {
    const entry = makeEntry({ flagged: true })
    const html = buildExportHtml('Inc', '2024-06-15T10:00:00Z', [entry])
    expect(html).toContain('Flagged')
  })

  it('embeds images as data URLs', () => {
    const entry = makeEntry({ image_paths: ['/imgs/shot.png'] })
    const html = buildExportHtml('Inc', '2024-06-15T10:00:00Z', [entry])
    expect(html).toContain('data:image/png;base64,FAKE_/imgs/shot.png')
  })

  it('includes summary section when provided', () => {
    const summaryJson = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Summary content' }] }]
    })
    const html = buildExportHtml('Inc', '2024-06-15T10:00:00Z', [], summaryJson)
    expect(html).toContain('Summary')
    expect(html).toContain('Summary content')
  })

  it('renders linked findings for hypotheses', () => {
    const hypothesis = makeEntry({
      id: 'h1',
      type: 'hypothesis',
      body: 'DNS issue',
      linked_finding_ids: ['f1'] as unknown as number[]
    })
    const finding = makeEntry({ id: 'f1', type: 'finding', body: 'Timeout in logs' })
    const html = buildExportHtml('Inc', '2024-06-15T10:00:00Z', [hypothesis, finding])
    expect(html).toContain('Findings')
    expect(html).toContain('Timeout in logs')
  })

  it('escapes HTML in entry bodies', () => {
    const entry = makeEntry({ body: '<b>bold</b>' })
    const html = buildExportHtml('Inc', '2024-06-15T10:00:00Z', [entry])
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;')
  })
})
