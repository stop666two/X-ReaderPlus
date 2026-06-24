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

class XReaderDB extends Dexie {
  lib!: Table<DbBook, string>
  ch!: Table<DbChapter, string>
  cfg!: Table<DbConfig, string>
  bm!: Table<DbBookmark, string>
  ann!: Table<DbAnnotation, string>
  tr!: Table<DbTrash, string>
  lbr!: Table<DbLibrary, string>

  constructor() {
    super('x-reader-plus')

    // Version 1: initial schema
    this.version(1).stores({
      lib: 'id',
      ch: 'bid',
      cfg: 'k',
      bm: 'id',
      ann: 'id',
      tr: 'id',
      lbr: 'id'
    })

    // Current version: ensure schema matches DB_VERSION
    this.version(DB_VERSION).stores({
      lib: 'id',
      ch: 'bid',
      cfg: 'k',
      bm: 'id',
      ann: 'id',
      tr: 'id',
      lbr: 'id'
    })
  }
}

export const db = new XReaderDB()

export async function initDb(): Promise<void> {
  await db.open()
  // Ensure default library exists
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
  logger.info('数据库初始化成功')
}

export async function clearAllData(): Promise<void> {
  await db.lib.clear()
  await db.ch.clear()
  await db.cfg.clear()
  await db.bm.clear()
  await db.ann.clear()
  await db.tr.clear()
  await db.lbr.clear()
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
