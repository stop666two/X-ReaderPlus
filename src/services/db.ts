import Dexie, { type Table } from 'dexie'
import { DB_VERSION, DEFAULT_LIBRARY_ID, DEFAULT_LIBRARY_NAME } from '@/constants'
import { logger } from './log'
import type { Library } from '@/types'

interface DbBook { id: string; data: string }
interface DbChapter { bid: string; data: string }
interface DbConfig { k: string; v: string }
interface DbBookmark { id: string; data: string }
interface DbAnnotation { id: string; data: string }
interface DbTrash { id: string; data: string }
interface DbLibrary { id: string; data: string }
interface DbMeta { bid: string; data: string }

class XReaderDB extends Dexie {
  lib!: Table<DbBook, string>
  ch!: Table<DbChapter, string>
  cfg!: Table<DbConfig, string>
  bm!: Table<DbBookmark, string>
  ann!: Table<DbAnnotation, string>
  tr!: Table<DbTrash, string>
  lbr!: Table<DbLibrary, string>
  meta!: Table<DbMeta, string>

  constructor() {
    super('x-reader-plus')

    this.version(5).stores({
      lib: 'id',
      ch: 'bid',
      cfg: 'k',
      bm: 'id',
      ann: 'id',
      tr: 'id',
      lbr: 'id'
    })

    this.version(DB_VERSION).stores({
      meta: 'bid'
    })
  }
}

export const db = new XReaderDB()

export async function initDb(): Promise<void> {
  // In Electron, SQLite is initialized via the main process (electronAPI.db.init).
  // We still open the Dexie DB as a fallback for backward compat in browser dev mode.
  // Check if electronAPI.books exists (top-level) — preload exposes books/chapters/etc
  // at the top level of electronAPI, NOT under electronAPI.db
  const hasElectronAPI = typeof window !== 'undefined' && window.electronAPI?.books

  if (hasElectronAPI) {
    try {
      // SQLite is initialized and ready via main process — no explicit init needed
      logger.info('SQLite 数据库可用')
    } catch (e) {
      logger.warn('SQLite 不可用，回退到 IndexedDB', e)
      await db.open()
      await ensureDefaultLibrary()
      logger.info('IndexedDB 数据库初始化成功')
    }
  } else {
    await db.open()
    await ensureDefaultLibrary()
    logger.info('IndexedDB 数据库初始化成功')
  }
}

async function ensureDefaultLibrary(): Promise<void> {
  const existing = await db.lbr.get(DEFAULT_LIBRARY_ID)
  if (!existing) {
    const defaultLib: Library = {
      id: DEFAULT_LIBRARY_ID,
      name: DEFAULT_LIBRARY_NAME,
      path: '',
      mode: 'copy',
      createdAt: Date.now(),
      bookCount: 0
    }
    await db.lbr.put({ id: DEFAULT_LIBRARY_ID, data: JSON.stringify(defaultLib) })
  }
}

export async function clearAllData(): Promise<void> {
  const hasElectronAPI = typeof window !== 'undefined' && window.electronAPI?.books

  if (hasElectronAPI) {
    try {
      await window.electronAPI?.clearAll()
    } catch (e) {
      logger.warn('SQLite clearAll 失败，回退到 IndexedDB', e)
      await clearIndexedDB()
    }
  } else {
    await clearIndexedDB()
  }
}

async function clearIndexedDB(): Promise<void> {
  await db.lib.clear()
  await db.ch.clear()
  await db.cfg.clear()
  await db.bm.clear()
  await db.ann.clear()
  await db.tr.clear()
  await db.lbr.clear()
  await db.meta.clear()
  // Recreate default library
  const defaultLib: Library = {
    id: DEFAULT_LIBRARY_ID,
    name: DEFAULT_LIBRARY_NAME,
    path: '',
    mode: 'copy',
    createdAt: Date.now(),
    bookCount: 0
  }
  await db.lbr.put({ id: DEFAULT_LIBRARY_ID, data: JSON.stringify(defaultLib) })
}
