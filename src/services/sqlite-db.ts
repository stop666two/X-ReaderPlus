import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import type { Book } from '@/types'

// Lazily initialize DB — avoids running better-sqlite3 at import time (M-7)
let _db: Database.Database | null = null

function ensureDb(): Database.Database {
  if (!_db) {
    const dbPath = join(app.getPath('userData'), 'x-reader-plus.db')
    _db = new Database(dbPath)
    // 启用WAL模式提升并发性能
    _db.pragma('journal_mode = WAL')
    _db.pragma('synchronous = NORMAL')
    // Create schema lazily on first DB access (M-7)
    _db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT DEFAULT '',
    author TEXT DEFAULT '未知作者',
    cover TEXT DEFAULT '',
    path TEXT DEFAULT '',
    format TEXT NOT NULL,
    size INTEGER DEFAULT 0,
    added_at INTEGER NOT NULL,
    last_read_at INTEGER DEFAULT 0,
    progress REAL DEFAULT 0,
    chapter_index INTEGER DEFAULT 0,
    chapter_progress REAL DEFAULT 0,
    tags TEXT DEFAULT '[]',
    rating INTEGER DEFAULT 0,
    review TEXT DEFAULT '',
    word_count INTEGER DEFAULT 0,
    chapter_count INTEGER DEFAULT 0,
    total_reading_time INTEGER DEFAULT 0,
    library_id TEXT DEFAULT 'default',
    content_hash TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS chapters (
    book_id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS annotations (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS trash (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS libraries (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_books_library ON books(library_id);
  CREATE INDEX IF NOT EXISTS idx_books_added ON books(added_at);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_book ON bookmarks(json_extract(data, '$.bookId'));
  CREATE INDEX IF NOT EXISTS idx_annotations_book ON annotations(json_extract(data, '$.bookId'));
`)
  }
  return _db
}

// Proxy to forward property access to lazy _db
const db = new Proxy({} as Database.Database, {
  get(_target, prop) {
    return (ensureDb() as any)[prop]
  }
})

export { db }

// 辅助函数
export function bookRowToBook(row: any): Book {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    cover: row.cover,
    path: row.path,
    format: row.format,
    size: row.size,
    addedAt: row.added_at,
    lastReadAt: row.last_read_at,
    progress: row.progress,
    chapterIndex: row.chapter_index,
    chapterProgress: row.chapter_progress,
    tags: JSON.parse(row.tags || '[]'),
    rating: row.rating,
    review: row.review,
    wordCount: row.word_count,
    chapterCount: row.chapter_count,
    totalReadingTime: row.total_reading_time,
    libraryId: row.library_id,
    contentHash: row.content_hash
  }
}

/**
 * Close the database connection, checkpointing WAL back into main file.
 * Must be called before app quits to prevent data loss.
 */
export function closeDb(): void {
  if (_db) {
    try { _db.pragma('wal_checkpoint(TRUNCATE)') } catch { /* best-effort WAL checkpoint */ }
    _db.close()
    _db = null
  }
}
