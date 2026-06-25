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

// Config helper — uses electronAPI in Electron, localStorage fallback in browser dev mode
function configGet(key: string): Promise<string | null> {
  if (typeof window !== 'undefined' && window.electronAPI?.config) {
    return window.electronAPI.config.get(key).then((v: string | undefined | null) => v ?? null)
  }
  return Promise.resolve(localStorage.getItem(key))
}

function configSet(key: string, value: string): Promise<void> {
  if (typeof window !== 'undefined' && window.electronAPI?.config) {
    return window.electronAPI.config.set(key, value)
  }
  localStorage.setItem(key, value)
  return Promise.resolve()
}

async function readStats(): Promise<StatsEntry[]> {
  const v = await configGet(STATS_KEY)
  if (v) {
    try { return JSON.parse(v) } catch { return [] }
  }
  return []
}

async function writeStats(entries: StatsEntry[]): Promise<void> {
  await configSet(STATS_KEY, JSON.stringify(entries))
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
