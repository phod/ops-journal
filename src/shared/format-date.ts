/**
 * Normalizes an ISO date string (appending 'Z' if missing) and formats it
 * for display. Falls back to the raw string on invalid input.
 */
export function formatDate(isoString: string, options?: Intl.DateTimeFormatOptions): string {
  const defaults: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }

  try {
    const normalized = isoString.endsWith('Z') ? isoString : isoString + 'Z'
    return new Date(normalized).toLocaleString(undefined, options ?? defaults)
  } catch {
    return isoString
  }
}
