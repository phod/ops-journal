import { vi, describe, it, expect, beforeEach } from 'vitest'
import { join } from 'path'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/fake/userData')
  }
}))

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  const overrides = {
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    readFileSync: vi.fn()
  }
  return {
    ...actual,
    ...overrides,
    default: { ...actual, ...overrides }
  }
})

vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-uuid-1234')
}))

import { mkdirSync, writeFileSync, unlinkSync, readFileSync } from 'fs'
import { getImagesDir, saveImage, deleteImage, readImageAsDataUrl } from '../images'

const mockMkdirSync = vi.mocked(mkdirSync)
const mockWriteFileSync = vi.mocked(writeFileSync)
const mockUnlinkSync = vi.mocked(unlinkSync)
const mockReadFileSync = vi.mocked(readFileSync)

beforeEach(() => {
  vi.clearAllMocks()
  mockReadFileSync.mockReturnValue(Buffer.from('fake-image-data') as unknown as string)
})

describe('getImagesDir', () => {
  it('returns path under userData/images', () => {
    const dir = getImagesDir()
    expect(dir).toBe(join('/fake/userData', 'images'))
  })

  it('creates the directory', () => {
    getImagesDir()
    expect(mockMkdirSync).toHaveBeenCalledWith(join('/fake/userData', 'images'), { recursive: true })
  })
})

describe('saveImage', () => {
  it('writes the buffer to a uuid-named png file and returns the path', () => {
    const buffer = Buffer.from('image-bytes')
    const filePath = saveImage(buffer)

    const expectedPath = join('/fake/userData', 'images', 'test-uuid-1234.png')
    expect(filePath).toBe(expectedPath)
    expect(mockWriteFileSync).toHaveBeenCalledWith(expectedPath, buffer)
  })
})

describe('deleteImage', () => {
  it('calls unlinkSync with the given path', () => {
    deleteImage('/some/image.png')
    expect(mockUnlinkSync).toHaveBeenCalledWith('/some/image.png')
  })

  it('does not throw when the file does not exist (ENOENT)', () => {
    const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    mockUnlinkSync.mockImplementation(() => { throw enoent })

    expect(() => deleteImage('/missing/image.png')).not.toThrow()
  })

  it('re-throws errors other than ENOENT', () => {
    const eperm = Object.assign(new Error('EPERM'), { code: 'EPERM' })
    mockUnlinkSync.mockImplementation(() => { throw eperm })

    expect(() => deleteImage('/no-permission.png')).toThrow('EPERM')
  })
})

describe('readImageAsDataUrl', () => {
  it('returns a base64 data URL from the file contents', () => {
    const fakeData = Buffer.from('png-bytes')
    mockReadFileSync.mockReturnValue(fakeData as unknown as string)

    const result = readImageAsDataUrl('/path/to/image.png')

    expect(mockReadFileSync).toHaveBeenCalledWith('/path/to/image.png')
    expect(result).toBe(`data:image/png;base64,${fakeData.toString('base64')}`)
  })
})
