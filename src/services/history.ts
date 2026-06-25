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

// Config helper — uses electronAPI in Electron, localStorage fallback in browser dev mode
function configGet(key: string): Promise<string | null> {
  if (typeof window !== 'undefined' && window.electronAPI?.config) {
    return window.electronAPI.config.get(key).then((v: string | undefined | null) => v ?? null)
  }
  // Fallback for browser dev mode
  return Promise.resolve(localStorage.getItem(key))
}

function configSet(key: string, value: string): Promise<void> {
  if (typeof window !== 'undefined' && window.electronAPI?.config) {
    return window.electronAPI.config.set(key, value)
  }
  localStorage.setItem(key, value)
  return Promise.resolve()
}

async function readHistory(): Promise<HistoryEntry[]> {
  const v = await configGet(HISTORY_KEY)
  if (v) {
    try { return JSON.parse(v) } catch { return [] }
  }
  return []
}

async function writeHistory(entries: HistoryEntry[]): Promise<void> {
  await configSet(HISTORY_KEY, JSON.stringify(entries))
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
