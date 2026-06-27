import { db } from '@/services/db'
import { logger } from './log'
import type { Book } from '@/types'

export interface BookMeta {
  bid: string
  title: string
  author: string
  cover: string
  format: string
  size: number
  chapterCount: number
  tags: string[]
  rating: number
  contentHash: string
  path: string
  libraryId: string
  addedAt: number
  lastReadAt: number
  progress: number
  wordCount: number
}

function bookToMeta(book: Book): BookMeta {
  return {
    bid: book.id,
    title: book.title,
    author: book.author,
    cover: book.cover,
    format: book.format,
    size: book.size,
    chapterCount: book.chapterCount,
    tags: book.tags,
    rating: book.rating,
    contentHash: book.contentHash || '',
    path: book.path,
    libraryId: book.libraryId,
    addedAt: book.addedAt,
    lastReadAt: book.lastReadAt,
    progress: book.progress,
    wordCount: book.wordCount
  }
}

// ---- API helpers: prefer electronAPI, fall back to Dexie ----
interface MetaAPI {
  toArray: () => Promise<any[]>
  put: (bid: string, data: string) => Promise<void>
  bulkPut: (entries: Array<{ bid: string; data: string }>) => Promise<void>
  bulkDelete: (ids: string[]) => Promise<void>
  count: () => Promise<number>
}

// Use Dexie (IndexedDB) for metadata — no electronAPI.meta exists in preload
function getMetaApi(): MetaAPI | null {
  // In browser mode with bridge, use the bridge's meta proxy (derived from books API)
  if (typeof window !== 'undefined' && window.electronAPI?.meta) {
    return window.electronAPI.meta
  }
  if (!db) return null
  return {
    toArray: () => db.meta.toArray(),
    put: async (bid: string, data: string) => { await db.meta.put({ bid, data }) },
    bulkPut: async (entries) => { await db.meta.bulkPut(entries) },
    bulkDelete: async (ids) => { await db.meta.bulkDelete(ids) },
    count: () => db.meta.count(),
  }
}

/** Bulk sync: call after importing books */
export async function syncMetas(books: Book[]): Promise<void> {
  try {
    const api = getMetaApi()
    if (!api) return // Tauri mode: metadata not needed
    await api.bulkPut(
      books.map(b => ({ bid: b.id, data: JSON.stringify(bookToMeta(b)) }))
    )
  } catch (e) {
    logger.error('syncMetas 失败', e)
  }
}

/** Upsert a single book's metadata */
export async function upsertMeta(book: Book): Promise<void> {
  try {
    const api = getMetaApi()
    if (!api) return
    await api.put(book.id, JSON.stringify(bookToMeta(book)))
  } catch (e) {
    logger.error('upsertMeta 失败', e)
  }
}

/** Delete metadata for the given book IDs */
export async function deleteMetas(ids: string[]): Promise<void> {
  try {
    const api = getMetaApi()
    if (!api) return
    await api.bulkDelete(ids)
  } catch (e) {
    logger.error('deleteMetas 失败', e)
  }
}

/** Get all metadata records */
export async function getAllMetas(): Promise<BookMeta[]> {
  try {
    // Prefer bridge metadata load
    if (typeof window !== 'undefined' && window.electronAPI?.books?.getAll) {
      const books = await window.electronAPI.books.getAll({ limit: 10000, offset: 0 })
      return (books || []).map((b: any) => ({
        bid: b.id,
        title: b.title || '',
        author: b.author || '',
        cover: b.cover || '',
        format: b.format || '',
        size: b.size || 0,
        chapterCount: b.chapterCount || 0,
        tags: Array.isArray(b.tags) ? b.tags : [],
        rating: b.rating || 0,
        contentHash: b.contentHash || '',
        path: b.path || '',
        libraryId: b.libraryId || '',
        addedAt: b.addedAt || 0,
        lastReadAt: b.lastReadAt || 0,
        progress: b.progress || 0,
        wordCount: b.wordCount || 0,
      }))
    }
    const api = getMetaApi()
    if (!api) return []
    const records = await api.toArray()
    return records.map((r: any) => {
      if (typeof r.data === 'string') return JSON.parse(r.data)
      return r.data || r
    })
  } catch (e) {
    logger.error('getAllMetas 失败', e)
    return []
  }
}

/** Get metadata count */
export async function getMetaCount(): Promise<number> {
  try {
    const api = getMetaApi()
    if (!api) return 0
    return await api.count()
  } catch {
    return 0
  }
}
