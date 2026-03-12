import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, writeFileSync, unlinkSync, readFileSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'

export function getImagesDir(): string {
  const dir = join(app.getPath('userData'), 'images')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function saveImage(buffer: Buffer): string {
  const dir = getImagesDir()
  const filename = `${uuidv4()}.png`
  const filePath = join(dir, filename)
  writeFileSync(filePath, buffer)
  return filePath
}

export function deleteImage(imagePath: string): void {
  try {
    unlinkSync(imagePath)
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
}

export function readImageAsDataUrl(imagePath: string): string {
  const buffer = readFileSync(imagePath)
  return `data:image/png;base64,${buffer.toString('base64')}`
}
