import { useEffect, useState } from 'react'

export function useEntryImages(imagePaths: string[]): Record<string, string> {
  const [dataUrls, setDataUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    for (const path of imagePaths) {
      if (!dataUrls[path]) {
        window.electronAPI.getEntryImage(path).then((dataUrl) => {
          if (!cancelled) {
            setDataUrls((prev) => ({ ...prev, [path]: dataUrl }))
          }
        }).catch(() => {})
      }
    }
    return () => { cancelled = true }
  }, [imagePaths])

  return dataUrls
}
