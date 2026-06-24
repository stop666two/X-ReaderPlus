import { db } from './db'

export interface StatsEntry {
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

const STATS_KEY = 'stats_data'

async function readStats(): Promise<StatsEntry[]> {
  const rec = await db.cfg.get(STATS_KEY)
  if (rec && rec.v) {
    try { return JSON.parse(rec.v) } catch { return [] }
  }
  return []
}

async function writeStats(entries: StatsEntry[]): Promise<void> {
  await db.cfg.put({ k: STATS_KEY, v: JSON.stringify(entries) })
}

export async function getStatsData(): Promise<StatsEntry[]> {
  return readStats()
}

export async function upsertStatsEntry(entry: StatsEntry): Promise<void> {
  const stats = await readStats()
  const idx = stats.findIndex(h => h.bookId === entry.bookId)
  if (idx >= 0) {
    stats[idx] = { ...stats[idx], ...entry }
  } else {
    stats.push(entry)
  }
  // Keep most recent 500 entries
  stats.sort((a, b) => b.lastReadAt - a.lastReadAt)
  const trimmed = stats.slice(0, 500)
  await writeStats(trimmed)
}

export async function clearAllStats(): Promise<void> {
  await writeStats([])
}

export async function clearDeletedStats(existingIds: Set<string>): Promise<void> {
  const stats = await readStats()
  const filtered = stats.filter(h => existingIds.has(h.bookId))
  await writeStats(filtered)
}

export async function removeStatsEntries(bookIds: string[]): Promise<void> {
  const stats = await readStats()
  const idSet = new Set(bookIds)
  const filtered = stats.filter(h => !idSet.has(h.bookId))
  await writeStats(filtered)
}
