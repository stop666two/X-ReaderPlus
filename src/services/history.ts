import { db } from './db'

export interface HistoryEntry {
  bookId: string
  title: string
  author: string
  cover: string
  format: string
  addedAt: number
  lastReadAt: number
  totalReadingTime: number
  progress: number
}

const HISTORY_KEY = 'history_data'

async function readHistory(): Promise<HistoryEntry[]> {
  const rec = await db.cfg.get(HISTORY_KEY)
  if (rec && rec.v) {
    try { return JSON.parse(rec.v) } catch { return [] }
  }
  return []
}

async function writeHistory(entries: HistoryEntry[]): Promise<void> {
  await db.cfg.put({ k: HISTORY_KEY, v: JSON.stringify(entries) })
}

export async function getHistory(): Promise<HistoryEntry[]> {
  return readHistory()
}

export async function upsertHistoryEntry(entry: HistoryEntry): Promise<void> {
  const history = await readHistory()
  const idx = history.findIndex(h => h.bookId === entry.bookId)
  if (idx >= 0) {
    history[idx] = { ...history[idx], ...entry }
  } else {
    history.push(entry)
  }
  // Keep most recent 500 entries
  history.sort((a, b) => b.lastReadAt - a.lastReadAt)
  const trimmed = history.slice(0, 500)
  await writeHistory(trimmed)
}

export async function clearAllHistory(): Promise<void> {
  await writeHistory([])
}

export async function clearDeletedHistory(existingIds: Set<string>): Promise<void> {
  const history = await readHistory()
  const filtered = history.filter(h => existingIds.has(h.bookId))
  await writeHistory(filtered)
}

export async function removeHistoryEntries(bookIds: string[]): Promise<void> {
  const history = await readHistory()
  const idSet = new Set(bookIds)
  const filtered = history.filter(h => !idSet.has(h.bookId))
  await writeHistory(filtered)
}
