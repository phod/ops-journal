/**
 * Extract image files from a clipboard paste event and convert them to DataURLs.
 * Returns the DataURLs asynchronously via the provided callback.
 * If images are found, the event is prevented from default handling.
 * Returns true if images were found, false otherwise.
 */
export function extractPastedImages(
  e: React.ClipboardEvent,
  onImage: (dataUrl: string) => void
): boolean {
  const items = e.clipboardData.items
  const imageItems: DataTransferItem[] = []
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.startsWith('image/')) imageItems.push(items[i])
  }
  if (imageItems.length === 0) return false
  e.preventDefault()
  for (const item of imageItems) {
    const file = item.getAsFile()
    if (!file) continue
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') onImage(reader.result)
    }
    reader.readAsDataURL(file)
  }
  return true
}
