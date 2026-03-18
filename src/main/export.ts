import { BrowserWindow } from 'electron'
import { writeFileSync } from 'fs'
import { readImageAsDataUrl } from './images'
import type { JournalEntry } from '@shared/ipc-types'
import { resolveEntriesByIds, getEntryTypeDefinition, HYPOTHESIS_STATUS_EXPORT_COLORS } from '@shared/entry-types'
import { formatDate } from '@shared/format-date'
import type { BoardState, BoardNode, BoardEdge } from '@shared/board-types'

function entryTypeLabel(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------------------
// TipTap JSON → plain text/markdown
// ---------------------------------------------------------------------------

interface TipTapNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TipTapNode[]
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  text?: string
}

type ImageHandling = 'omit' | 'reference'

function imageToken(imagePath: string, imageHandling: ImageHandling, prefix = ''): string {
  if (imageHandling === 'omit') return ''
  const basename = imagePath.split(/[\\/]/).pop() ?? imagePath
  return `${prefix}[image: ${basename}]\n`
}

function tiptapNodeToMarkdown(node: TipTapNode, indent = 0, imageHandling: ImageHandling = 'omit'): string {
  const recurse = (n: TipTapNode) => tiptapNodeToMarkdown(n, indent, imageHandling)

  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map(recurse).join('\n')

    case 'paragraph': {
      const inner = tiptapInlineToMarkdown(node.content ?? [])
      return inner ? inner + '\n' : '\n'
    }

    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1
      const prefix = '#'.repeat(level)
      const inner = tiptapInlineToMarkdown(node.content ?? [])
      return `${prefix} ${inner}\n`
    }

    case 'bulletList':
      return (node.content ?? []).map((item) => tiptapListItemToMarkdown(item, indent, '-', imageHandling)).join('')

    case 'orderedList':
      return (node.content ?? []).map((item, i) => tiptapListItemToMarkdown(item, indent, `${i + 1}.`, imageHandling)).join('')

    case 'blockquote': {
      const inner = (node.content ?? []).map(recurse).join('')
      return inner.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n') + '\n'
    }

    case 'codeBlock': {
      const lang = (node.attrs?.language as string) ?? ''
      const code = (node.content ?? []).map((n) => n.text ?? '').join('')
      return `\`\`\`${lang}\n${code}\n\`\`\`\n`
    }

    case 'horizontalRule':
      return '---\n'

    case 'hardBreak':
      return '\n'

    case 'entryRef': {
      const a = node.attrs ?? {}
      const type = (a.entryType as string) ?? 'note'
      const body = (a.entryBody as string) ?? ''
      const ts = a.entryTimestamp as string | undefined
      const tsStr = ts ? ` · ${formatDate(ts)}` : ''
      const flagStr = a.entryFlagged ? ' ⚑' : ''
      const lines = [`> **[${entryTypeLabel(type)}${tsStr}]**${flagStr}`]
      if (body) lines.push(`> ${body.replace(/\n/g, '\n> ')}`)
      const imagePaths = (a.entryImagePaths as string[]) ?? []
      for (const p of imagePaths) {
        const token = imageToken(p, imageHandling, '> ')
        if (token) lines.push(token.trimEnd())
      }
      return lines.join('\n') + '\n'
    }

    case 'summaryImage': {
      const src = node.attrs?.src as string | undefined
      if (!src) return ''
      return imageToken(src, imageHandling)
    }

    default:
      return (node.content ?? []).map(recurse).join('')
  }
}

function tiptapListItemToMarkdown(item: TipTapNode, indent: number, bullet: string, imageHandling: ImageHandling): string {
  const pad = '  '.repeat(indent)
  const children = item.content ?? []
  const firstPara = children[0]
  const rest = children.slice(1)
  const firstText = firstPara ? tiptapInlineToMarkdown(firstPara.content ?? []) : ''
  const restText = rest.map((n) => tiptapNodeToMarkdown(n, indent + 1, imageHandling)).join('')
  return `${pad}${bullet} ${firstText}\n${restText}`
}

function tiptapInlineToMarkdown(nodes: TipTapNode[]): string {
  return nodes.map((n) => {
    if (n.type === 'text') {
      let text = n.text ?? ''
      const marks = n.marks ?? []
      for (const mark of marks) {
        if (mark.type === 'bold') text = `**${text}**`
        else if (mark.type === 'italic') text = `_${text}_`
        else if (mark.type === 'code') text = `\`${text}\``
        else if (mark.type === 'strike') text = `~~${text}~~`
        else if (mark.type === 'link') text = `[${text}](${(mark.attrs?.href as string) ?? ''})`
      }
      return text
    }
    if (n.type === 'hardBreak') return '\n'
    return ''
  }).join('')
}

// ---------------------------------------------------------------------------
// TipTap JSON → HTML (for PDF)
// ---------------------------------------------------------------------------

function tiptapNodeToHtml(node: TipTapNode): string {
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map(tiptapNodeToHtml).join('')

    case 'paragraph': {
      const inner = tiptapInlineToHtml(node.content ?? [])
      return `<p style="margin:0 0 10px;font-size:18px;line-height:1.7;color:#1f2937;">${inner || '&nbsp;'}</p>`
    }

    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1
      const sizes = ['26px', '22px', '20px', '18px', '16px', '14px']
      const size = sizes[level - 1] ?? '13px'
      const inner = tiptapInlineToHtml(node.content ?? [])
      return `<h${level} style="font-size:${size};font-weight:700;color:#111827;margin:18px 0 8px;">${inner}</h${level}>`
    }

    case 'bulletList':
      return `<ul style="margin:0 0 10px;padding-left:22px;color:#1f2937;font-size:18px;">${(node.content ?? []).map(tiptapNodeToHtml).join('')}</ul>`

    case 'orderedList':
      return `<ol style="margin:0 0 10px;padding-left:22px;color:#1f2937;font-size:18px;">${(node.content ?? []).map(tiptapNodeToHtml).join('')}</ol>`

    case 'listItem':
      return `<li style="margin-bottom:5px;color:#1f2937;line-height:1.7;">${(node.content ?? []).map(tiptapNodeToHtml).join('')}</li>`

    case 'blockquote':
      return `<blockquote style="border-left:3px solid #d1d5db;margin:10px 0;padding:4px 14px;color:#6b7280;font-size:18px;">${(node.content ?? []).map(tiptapNodeToHtml).join('')}</blockquote>`

    case 'codeBlock': {
      const code = (node.content ?? []).map((n) => n.text ?? '').join('')
      return `<pre style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;font-size:12px;color:#1e293b;margin:10px 0;"><code>${escapeHtml(code)}</code></pre>`
    }

    case 'horizontalRule':
      return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />`

    case 'hardBreak':
      return '<br />'

    case 'entryRef': {
      const a = node.attrs ?? {}
      const type = (a.entryType as string) ?? 'note'
      const body = (a.entryBody as string) ?? ''
      const ts = a.entryTimestamp as string | undefined
      const hypothesisStatus = (a.entryHypothesisStatus as string) ?? null
      const c = getEntryTypeDefinition(type).exportColors
      const isHypothesis = type === 'hypothesis'
      const imagePaths = (a.entryImagePaths as string[]) ?? []
      const linkedFindings = (a.entryLinkedFindings as { id: string; body: string }[]) ?? []
      const childHypotheses = (a.entryChildHypotheses as { id: string; body: string; status: string }[]) ?? []
      const parentHypotheses = (a.entryParentHypotheses as { id: string; body: string; status: string }[]) ?? []
      const imagesHtml = imagePaths.map((p) => {
        try {
          const dataUrl = readImageAsDataUrl(p)
          return `<div style="page-break-inside:avoid;margin-top:8px;"><img src="${dataUrl}" style="max-width:100%;max-height:85vh;width:auto;height:auto;display:block;border-radius:4px;border:1px solid ${c.border};" /></div>`
        } catch {
          return `<em style="color:#9ca3af;">[image unavailable]</em>`
        }
      }).join('')
      const fc = getEntryTypeDefinition('finding').exportColors
      const findingsHtml = isHypothesis && linkedFindings.length > 0
        ? `<div style="margin-top:10px;">
            <div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Findings</div>
            ${linkedFindings.map((f) => `<div style="padding:6px 10px;margin-bottom:4px;border-radius:4px;background:${fc.bg};border:1px solid ${fc.border};font-size:14px;color:${fc.text};">${escapeHtml(f.body || '(no text)')}</div>`).join('')}
          </div>`
        : ''
      const childrenHtml = isHypothesis && childHypotheses.length > 0
        ? `<div style="margin-top:10px;">
            <div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Child Hypotheses</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              ${childHypotheses.map((ch) => {
                const sc = HYPOTHESIS_STATUS_EXPORT_COLORS[ch.status] ?? HYPOTHESIS_STATUS_EXPORT_COLORS.open
                return `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:4px;background:#f5f3ff;border:1px solid #c4b5fd;font-size:13px;color:#5b21b6;">
                  <span style="font-weight:700;color:${sc.text};">${escapeHtml(ch.status.charAt(0).toUpperCase() + ch.status.slice(1))}</span>
                  ${escapeHtml(ch.body || '(no text)')}
                </span>`
              }).join('')}
            </div>
          </div>`
        : ''
      const parentsHtml = isHypothesis && parentHypotheses.length > 0
        ? `<div style="margin-top:10px;">
            <div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Parent Hypothesis</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              ${parentHypotheses.map((p) => {
                const sc = HYPOTHESIS_STATUS_EXPORT_COLORS[p.status] ?? HYPOTHESIS_STATUS_EXPORT_COLORS.open
                return `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:4px;background:#ede9fe;border:1px solid #c4b5fd;font-size:13px;color:#5b21b6;">
                  <span style="font-weight:700;color:${sc.text};">${escapeHtml(p.status.charAt(0).toUpperCase() + p.status.slice(1))}</span>
                  ${escapeHtml(p.body || '(no text)')}
                </span>`
              }).join('')}
            </div>
          </div>`
        : ''
      return `
        <div style="margin:10px 0;padding:10px 12px;background:${c.bg};border:1px solid ${c.border};border-left:3px solid ${c.border};border-radius:6px;">
          <div style="page-break-inside:avoid;">
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
              <span style="font-size:12px;font-weight:700;color:${c.text};text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(entryTypeLabel(type))}</span>
              ${isHypothesis && hypothesisStatus ? hypothesisStatusBadgeHtml(hypothesisStatus) : ''}
              ${a.entryFlagged ? '<span style="display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;background:#fef3c7;border:1px solid #f59e0b;color:#92400e;">⚑ Flagged</span>' : ''}
              ${ts ? `<span style="font-size:14px;color:#6b7280;">${formatDate(ts)}</span>` : ''}
            </div>
            ${body ? `<div style="font-size:18px;color:#1f2937;white-space:pre-wrap;line-height:1.7;">${escapeHtml(body)}</div>` : ''}
          </div>
          ${imagesHtml}
          ${parentsHtml}
          ${findingsHtml}
          ${childrenHtml}
        </div>`
    }

    case 'summaryImage': {
      const src = node.attrs?.src as string | undefined
      if (!src) return ''
      try {
        const dataUrl = readImageAsDataUrl(src)
        return `<div style="page-break-inside:avoid;margin:10px 0;"><img src="${dataUrl}" style="max-width:100%;max-height:85vh;width:auto;height:auto;display:block;border-radius:6px;border:1px solid #e5e7eb;" /></div>`
      } catch {
        return `<em style="color:#9ca3af;">[image unavailable]</em>`
      }
    }

    default:
      return (node.content ?? []).map(tiptapNodeToHtml).join('')
  }
}

function tiptapInlineToHtml(nodes: TipTapNode[]): string {
  return nodes.map((n) => {
    if (n.type === 'text') {
      let text = escapeHtml(n.text ?? '')
      const marks = n.marks ?? []
      for (const mark of marks) {
        if (mark.type === 'bold') text = `<strong>${text}</strong>`
        else if (mark.type === 'italic') text = `<em>${text}</em>`
        else if (mark.type === 'code') text = `<code style="background:#f1f5f9;border:1px solid #e2e8f0;padding:1px 4px;border-radius:3px;font-size:13px;color:#1e293b;">${text}</code>`
        else if (mark.type === 'strike') text = `<s>${text}</s>`
        else if (mark.type === 'link') text = `<a href="${escapeHtml((mark.attrs?.href as string) ?? '')}" style="color:#60a5fa;">${text}</a>`
      }
      return text
    }
    if (n.type === 'hardBreak') return '<br />'
    return ''
  }).join('')
}

export function summaryJsonToMarkdown(summaryJson: string, imageHandling: ImageHandling = 'omit'): string {
  try {
    const doc = JSON.parse(summaryJson) as TipTapNode
    return tiptapNodeToMarkdown(doc, 0, imageHandling).trim()
  } catch {
    return ''
  }
}

export function summaryJsonToHtml(summaryJson: string): string {
  try {
    const doc = JSON.parse(summaryJson) as TipTapNode
    return tiptapNodeToHtml(doc)
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------------------
// Export functions
// ---------------------------------------------------------------------------

export function exportAsMarkdown(
  investigationName: string,
  createdAt: string,
  entries: JournalEntry[],
  summaryJson?: string,
  imageHandling: ImageHandling = 'omit'
): string {
  const lines: string[] = []
  lines.push(`# ${investigationName}`)
  lines.push(`Created: ${formatDate(createdAt)}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  if (summaryJson) {
    lines.push('## Summary')
    lines.push('')
    lines.push(summaryJsonToMarkdown(summaryJson, imageHandling))
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  if (entries.length > 0) {
    lines.push('## Entries')
    lines.push('')

    for (const entry of entries) {
      const isHypothesis = entry.type === 'hypothesis'
      const statusStr = isHypothesis ? ` [${(entry.hypothesis_status ?? 'open').toUpperCase()}]` : ''
      const flagStr = entry.flagged ? ' ⚑' : ''
      lines.push(`### [${formatDate(entry.created_at)}] ${entryTypeLabel(entry.type)}${statusStr}${flagStr}`)
      lines.push('')
      lines.push(entry.body)
      lines.push('')

      for (const imagePath of entry.image_paths) {
        const token = imageToken(imagePath, imageHandling)
        if (token) lines.push(token)
      }

      // Parent hypotheses
      if (isHypothesis) {
        const parents = entries.filter((e) => e.type === 'hypothesis' && e.linked_child_hypothesis_ids?.includes(entry.id))
        if (parents.length > 0) {
          lines.push(`**Parent:** ${parents.map((p) => `${p.body} [${(p.hypothesis_status ?? 'open').toUpperCase()}]`).join(', ')}`)
          lines.push('')
        }
      }

      // Linked findings
      if (isHypothesis) {
        const findings = resolveEntriesByIds(entry.linked_finding_ids, entries)
        if (findings.length > 0) {
          lines.push('**Findings:**')
          for (const f of findings) {
            lines.push(`- ${f.body || '(no text)'}`)
          }
          lines.push('')
        }
      }

      // Child hypotheses
      if (isHypothesis) {
        const children = resolveEntriesByIds(entry.linked_child_hypothesis_ids, entries)
        if (children.length > 0) {
          lines.push('**Child Hypotheses:**')
          for (const ch of children) {
            lines.push(`- ${ch.body || '(no text)'} [${(ch.hypothesis_status ?? 'open').toUpperCase()}]`)
          }
          lines.push('')
        }
      }

      lines.push('---')
      lines.push('')
    }
  }

  return lines.join('\n')
}

function hypothesisStatusBadgeHtml(status: string): string {
  const sc = HYPOTHESIS_STATUS_EXPORT_COLORS[status] ?? HYPOTHESIS_STATUS_EXPORT_COLORS.open
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  return `<span style="display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;background:${sc.bg};border:1px solid ${sc.border};color:${sc.text};text-transform:capitalize;">${escapeHtml(label)}</span>`
}

function linkedFindingsHtml(entry: JournalEntry, allEntries: JournalEntry[]): string {
  if (entry.type !== 'hypothesis') return ''
  const findings = resolveEntriesByIds(entry.linked_finding_ids, allEntries)
  if (findings.length === 0) return ''
  const fc = getEntryTypeDefinition('finding').exportColors
  return `
    <div style="margin-top:10px;">
      <div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Findings</div>
      ${findings.map((f) => `<div style="padding:6px 10px;margin-bottom:4px;border-radius:4px;background:${fc.bg};border:1px solid ${fc.border};font-size:14px;color:${fc.text};">${escapeHtml(f.body || '(no text)')}</div>`).join('')}
    </div>`
}

function linkedChildHypothesesHtml(entry: JournalEntry, allEntries: JournalEntry[]): string {
  if (entry.type !== 'hypothesis') return ''
  const children = resolveEntriesByIds(entry.linked_child_hypothesis_ids, allEntries)
  if (children.length === 0) return ''
  return `
    <div style="margin-top:10px;">
      <div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Child Hypotheses</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${children.map((ch) => {
          const s = ch.hypothesis_status ?? 'open'
          const sc = HYPOTHESIS_STATUS_EXPORT_COLORS[s] ?? HYPOTHESIS_STATUS_EXPORT_COLORS.open
          return `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:4px;background:#f5f3ff;border:1px solid #c4b5fd;font-size:13px;color:#5b21b6;">
            <span style="font-weight:700;color:${sc.text};">${escapeHtml(s.charAt(0).toUpperCase() + s.slice(1))}</span>
            ${escapeHtml(ch.body || '(no text)')}
          </span>`
        }).join('')}
      </div>
    </div>`
}

function parentHypothesesHtml(entry: JournalEntry, allEntries: JournalEntry[]): string {
  if (entry.type !== 'hypothesis') return ''
  const parents = allEntries.filter((e) => e.type === 'hypothesis' && e.linked_child_hypothesis_ids?.includes(entry.id))
  if (parents.length === 0) return ''
  return `
    <div style="margin-top:10px;">
      <div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Parent Hypothesis</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${parents.map((p) => {
          const s = p.hypothesis_status ?? 'open'
          const sc = HYPOTHESIS_STATUS_EXPORT_COLORS[s] ?? HYPOTHESIS_STATUS_EXPORT_COLORS.open
          return `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:4px;background:#ede9fe;border:1px solid #c4b5fd;font-size:13px;color:#5b21b6;">
            <span style="font-weight:700;color:${sc.text};">${escapeHtml(s.charAt(0).toUpperCase() + s.slice(1))}</span>
            ${escapeHtml(p.body || '(no text)')}
          </span>`
        }).join('')}
      </div>
    </div>`
}

// ---------------------------------------------------------------------------
// Board → HTML (for PDF)
// ---------------------------------------------------------------------------

const BOARD_NODE_COLORS: Record<string, { bg: string; border: string; text: string; badge: string; badgeText: string }> = {
  note:       { bg: '#f9fafb', border: '#d1d5db', text: '#374151', badge: '#6b7280', badgeText: '#ffffff' },
  action:     { bg: '#fff7ed', border: '#fb923c', text: '#9a3412', badge: '#fb923c', badgeText: '#431407' },
  finding:    { bg: '#f0fdfa', border: '#2dd4bf', text: '#134e4a', badge: '#2dd4bf', badgeText: '#042f2e' },
  hypothesis: { bg: '#f5f3ff', border: '#a78bfa', text: '#5b21b6', badge: '#8b5cf6', badgeText: '#faf5ff' },
}

function boardNodeHtml(node: BoardNode, allEntries: JournalEntry[], offsetX: number, offsetY: number): string {
  const x = node.position_x - offsetX
  const y = node.position_y - offsetY
  const w = node.width ?? 220
  const h = node.height ?? 70
  const data = JSON.parse(node.data_json)

  if (node.node_type === 'entry') {
    const entry = allEntries.find((e) => e.id === data.entryId)
    if (!entry) {
      return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;min-height:${h}px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:6px;padding:8px 10px;font-size:12px;color:#9ca3af;font-style:italic;">[deleted entry]</div>`
    }
    const c = BOARD_NODE_COLORS[entry.type] ?? BOARD_NODE_COLORS.note
    const truncated = entry.body.length > 150 ? entry.body.slice(0, 150) + '…' : entry.body
    const label = entryTypeLabel(entry.type)
    return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;min-height:${h}px;background:${c.bg};border:1px solid ${c.border};border-radius:6px;padding:8px 10px;overflow:hidden;">
      <span style="display:inline-block;font-size:10px;font-weight:700;padding:1px 6px;border-radius:3px;background:${c.badge};color:${c.badgeText};text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">${escapeHtml(label)}</span>
      <div style="font-size:12px;color:${c.text};white-space:pre-wrap;line-height:1.5;word-break:break-word;">${escapeHtml(truncated)}</div>
    </div>`
  }

  if (node.node_type === 'textbox') {
    const text = (data.text as string) || ''
    return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;min-height:${h}px;background:#ffffff;border:1px solid #d1d5db;border-radius:6px;padding:8px 10px;">
      <div style="font-size:12px;color:#374151;white-space:pre-wrap;line-height:1.5;word-break:break-word;">${escapeHtml(text) || '<span style="color:#9ca3af;font-style:italic;">Empty</span>'}</div>
    </div>`
  }

  if (node.node_type === 'image') {
    const imagePath = data.imagePath as string
    try {
      const dataUrl = readImageAsDataUrl(imagePath)
      return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;min-height:${h}px;background:#ffffff;border:1px solid #d1d5db;border-radius:6px;overflow:hidden;">
        <img src="${dataUrl}" style="display:block;width:100%;height:auto;object-fit:contain;" />
      </div>`
    } catch {
      return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;min-height:${h}px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:6px;padding:8px 10px;font-size:12px;color:#9ca3af;font-style:italic;">[image unavailable]</div>`
    }
  }

  return ''
}

function boardEdgeSvg(edge: BoardEdge, nodes: BoardNode[], offsetX: number, offsetY: number): string {
  const src = nodes.find((n) => n.id === edge.source_node_id)
  const tgt = nodes.find((n) => n.id === edge.target_node_id)
  if (!src || !tgt) return ''

  const sw = src.width ?? 220
  const sh = src.height ?? 70
  const tw = tgt.width ?? 220
  const th = tgt.height ?? 70

  const x1 = src.position_x - offsetX + sw / 2
  const y1 = src.position_y - offsetY + sh / 2
  const x2 = tgt.position_x - offsetX + tw / 2
  const y2 = tgt.position_y - offsetY + th / 2

  let labelHtml = ''
  if (edge.label) {
    const mx = (x1 + x2) / 2
    const my = (y1 + y2) / 2
    labelHtml = `<text x="${mx}" y="${my - 6}" text-anchor="middle" font-size="10" fill="#6b7280" font-family="-apple-system,BlinkMacSystemFont,sans-serif">${escapeHtml(edge.label)}</text>`
  }

  // Read per-edge arrow direction from style_json
  const parsed = edge.style_json ? JSON.parse(edge.style_json) : {}
  const direction: string = parsed.arrowDirection ?? 'forward'
  const showEnd = direction === 'forward' || direction === 'both'
  const showStart = direction === 'reverse' || direction === 'both'
  const markerEnd = showEnd ? ' marker-end="url(#arrowhead)"' : ''
  const markerStart = showStart ? ' marker-start="url(#arrowhead-reverse)"' : ''
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#3b82f6" stroke-width="2"${markerStart}${markerEnd} />${labelHtml}`
}

function buildBoardSectionHtml(boardStates: BoardState[], boardEntries: JournalEntry[]): string {
  if (boardStates.length === 0) return ''

  const sections = boardStates.map((state) => {
    const { board, nodes, edges } = state
    if (nodes.length === 0) return ''

    // Calculate bounding box
    const padding = 40
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of nodes) {
      const w = n.width ?? 220
      const h = n.height ?? 70
      if (n.position_x < minX) minX = n.position_x
      if (n.position_y < minY) minY = n.position_y
      if (n.position_x + w > maxX) maxX = n.position_x + w
      if (n.position_y + h > maxY) maxY = n.position_y + h
    }

    const canvasW = maxX - minX + padding * 2
    const canvasH = maxY - minY + padding * 2
    const offsetX = minX - padding
    const offsetY = minY - padding

    const nodesHtml = nodes.map((n) => boardNodeHtml(n, boardEntries, offsetX, offsetY)).join('')
    const edgesSvg = edges.map((e) => boardEdgeSvg(e, nodes, offsetX, offsetY)).join('')

    return `
      <div style="margin-bottom:24px;">
        <h3 style="font-size:16px;font-weight:600;color:#374151;margin:0 0 12px;">${escapeHtml(board.name)}</h3>
        <div style="position:relative;width:${canvasW}px;height:${canvasH}px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <svg width="${canvasW}" height="${canvasH}" style="position:absolute;top:0;left:0;pointer-events:none;">
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#3b82f6" />
              </marker>
              <marker id="arrowhead-reverse" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto-start-reverse">
                <polygon points="0 0, 8 3, 0 6" fill="#3b82f6" />
              </marker>
            </defs>
            ${edgesSvg}
          </svg>
          ${nodesHtml}
        </div>
      </div>`
  }).filter(Boolean)

  if (sections.length === 0) return ''

  return `
    <div style="page-break-before:always;"></div>
    <h2 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.05em;">Rumour Boards</h2>
    ${sections.join('')}`
}

export function buildExportHtml(
  investigationName: string,
  createdAt: string,
  entries: JournalEntry[],
  summaryJson?: string,
  boardStates?: BoardState[],
  boardEntries?: JournalEntry[]
): string {
  const summarySection = summaryJson
    ? `
      <div style="margin-bottom:36px;">
        <h2 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.05em;">Summary</h2>
        ${summaryJsonToHtml(summaryJson)}
      </div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin-bottom:32px;" />`
    : ''

  const entryRows = entries.length > 0
    ? `
      <h2 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.05em;">Entries</h2>
      ${entries.map((entry) => {
        const c = getEntryTypeDefinition(entry.type).exportColors
        const isHypothesis = entry.type === 'hypothesis'
        const status = entry.hypothesis_status ?? 'open'
        const images = entry.image_paths
          .map((p) => {
            try {
              const dataUrl = readImageAsDataUrl(p)
              return `<div style="page-break-inside:avoid;margin-top:12px;"><img src="${dataUrl}" style="max-width:100%;max-height:85vh;width:auto;height:auto;display:block;border-radius:4px;border:1px solid #e5e7eb;" /></div>`
            } catch {
              return `<em style="color:#9ca3af;">[image unavailable]</em>`
            }
          })
          .join('')
        return `
          <div style="margin-bottom:20px;padding:14px 16px;background:${c.bg};border-radius:6px;border:1px solid ${c.border};">
            <div style="page-break-inside:avoid;">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                <span style="font-size:12px;font-weight:700;color:${c.text};text-transform:uppercase;letter-spacing:0.06em;">${entryTypeLabel(entry.type)}</span>
                ${isHypothesis ? hypothesisStatusBadgeHtml(status) : ''}
                ${entry.flagged ? '<span style="display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;background:#fef3c7;border:1px solid #f59e0b;color:#92400e;">⚑ Flagged</span>' : ''}
                <span style="font-size:14px;color:#6b7280;">${formatDate(entry.created_at)}</span>
              </div>
              <div style="font-size:18px;color:#1f2937;white-space:pre-wrap;line-height:1.7;">${escapeHtml(entry.body)}</div>
            </div>
            ${images}
            ${parentHypothesesHtml(entry, entries)}
            ${linkedFindingsHtml(entry, entries)}
            ${linkedChildHypothesesHtml(entry, entries)}
          </div>`
      }).join('')}`
    : ''

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #ffffff; color: #1f2937; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 48px 52px; }
        h1 { font-size: 28px; font-weight: 800; color: #111827; margin-bottom: 4px; }
        .meta { font-size: 14px; color: #6b7280; margin-bottom: 36px; }
        hr { border: none; border-top: 1px solid #e5e7eb; margin-bottom: 32px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(investigationName)}</h1>
      <div class="meta">Created: ${formatDate(createdAt)}</div>
      <hr />
      ${summarySection}
      ${entryRows}
      ${boardStates ? buildBoardSectionHtml(boardStates, boardEntries ?? entries) : ''}
    </body>
    </html>
  `
}

export async function exportAsPdf(
  investigationName: string,
  createdAt: string,
  entries: JournalEntry[],
  savePath: string,
  summaryJson?: string,
  boardStates?: BoardState[],
  boardEntries?: JournalEntry[]
): Promise<void> {
  const html = buildExportHtml(investigationName, createdAt, entries, summaryJson, boardStates, boardEntries)
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } })
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  const pdfBuffer = await win.webContents.printToPDF({})
  win.destroy()
  writeFileSync(savePath, pdfBuffer)
}
