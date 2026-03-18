export function scrollToEntry(id: string | number) {
  const el = document.getElementById(`entry-${id}`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}
