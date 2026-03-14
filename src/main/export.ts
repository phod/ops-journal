import { BrowserWindow } from 'electron'
import { writeFileSync } from 'fs'
import { readImageAsDataUrl } from './images'
import type { JournalEntry } from '@shared/ipc-types'

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString()
}

function entryTypeLabel(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export function exportAsMarkdown(investigationName: string, createdAt: string, entries: JournalEntry[]): string {
  const lines: string[] = []
  lines.push(`# ${investigationName}`)
  lines.push(`Created: ${formatTimestamp(createdAt)}`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## Entries')
  lines.push('')

  for (const entry of entries) {
    lines.push(`### [${formatTimestamp(entry.created_at)}] ${entryTypeLabel(entry.type)}`)
    lines.push('')
    lines.push(entry.body)
    lines.push('')

    if (entry.image_paths.length > 0) {
      for (const imagePath of entry.image_paths) {
        try {
          const dataUrl = readImageAsDataUrl(imagePath)
          lines.push(`![image](${dataUrl})`)
          lines.push('')
        } catch {
          lines.push(`[image unavailable: ${imagePath}]`)
          lines.push('')
        }
      }
    }

    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

export async function exportAsPdf(
  investigationName: string,
  createdAt: string,
  entries: JournalEntry[],
  savePath: string
): Promise<void> {
  const entryRows = entries
    .map((entry) => {
      const images = entry.image_paths
        .map((p) => {
          try {
            const dataUrl = readImageAsDataUrl(p)
            return `<img src="${dataUrl}" style="max-width:100%;margin-top:8px;border-radius:4px;" />`
          } catch {
            return `<em>[image unavailable]</em>`
          }
        })
        .join('')

      const typeColors: Record<string, string> = {
        finding: '#4ade80',
        action: '#60a5fa',
        hypothesis: '#f59e0b',
        note: '#9ca3af'
      }
      const color = typeColors[entry.type] ?? '#9ca3af'

      return `
        <div style="margin-bottom:24px;padding:16px;background:#1f2937;border-radius:8px;border:1px solid #374151;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            <span style="font-size:11px;font-weight:600;color:${color};text-transform:uppercase;letter-spacing:0.05em;">${entryTypeLabel(entry.type)}</span>
            <span style="font-size:11px;color:#6b7280;">${formatTimestamp(entry.created_at)}</span>
          </div>
          <div style="font-size:13px;color:#e5e7eb;white-space:pre-wrap;line-height:1.6;">${escapeHtml(entry.body)}</div>
          ${images}
        </div>
      `
    })
    .join('')

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #e5e7eb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; }
        h1 { font-size: 22px; font-weight: 700; color: #f9fafb; margin-bottom: 6px; }
        .meta { font-size: 12px; color: #6b7280; margin-bottom: 32px; }
        hr { border: none; border-top: 1px solid #374151; margin-bottom: 28px; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(investigationName)}</h1>
      <div class="meta">Created: ${formatTimestamp(createdAt)}</div>
      <hr />
      ${entryRows}
    </body>
    </html>
  `

  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } })
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  const pdfBuffer = await win.webContents.printToPDF({})
  win.destroy()
  writeFileSync(savePath, pdfBuffer)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
