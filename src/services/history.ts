export interface HistoryEntry {
  bookId: string; title: string; author: string; cover: string
  format: string; addedAt: number; lastReadAt: number
  totalReadingTime: number; progress: number
}

const B = 'http://127.0.0.1:34123'
const get = (p: string) => fetch(B + p).then(r => r.json()).catch(() => null)
const post = (p: string, b: any) => fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).catch(() => {})

export async function getHistory(): Promise<HistoryEntry[]> {
  try { const items = await get('/api/history'); return (items || []).map((i: any) => ({ ...(typeof i.data === 'string' ? JSON.parse(i.data) : (i.data || i)), bookId: i.bookId || (typeof i.data === 'string' ? JSON.parse(i.data) : (i.data || {})).bookId })) } catch { return [] }
}
export async function upsertHistoryEntry(e: HistoryEntry): Promise<void> { await post('/api/history', { bookId: e.bookId, data: JSON.stringify(e) }) }
export async function clearAllHistory(): Promise<void> { await post('/api/clear', {}) }
export async function clearDeletedHistory(_existingIds?: Set<string>): Promise<void> {}
export async function removeHistoryEntries(ids: string[]): Promise<void> {}
