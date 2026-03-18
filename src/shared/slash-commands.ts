import type { EntryType } from './ipc-types'
import type { EntryTypeDefinition } from './entry-types'
import { SLASH_COMMANDS } from './entry-types'

export function parseSlashCommand(text: string): { type: EntryType; body: string } {
  const trimmed = text.trimStart()
  for (const def of SLASH_COMMANDS) {
    const cmd = def.command!
    if (trimmed.startsWith(cmd)) {
      const rest = trimmed.slice(cmd.length)
      if (rest === '' || rest.startsWith(' ') || rest.startsWith('\n')) {
        return { type: def.type, body: rest.trimStart() }
      }
    }
  }
  return { type: 'note', body: text }
}

export function getCompletions(prefix: string): EntryTypeDefinition[] {
  if (!prefix.startsWith('/')) return []
  const lower = prefix.toLowerCase()
  // Don't show completions when the prefix already exactly matches a command
  if (SLASH_COMMANDS.some((d) => d.command! === lower)) return []
  return SLASH_COMMANDS.filter((d) => d.command!.startsWith(lower))
}
