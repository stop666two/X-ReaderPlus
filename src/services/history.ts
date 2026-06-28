export interface HistoryEntry {
  bookId: string; title: string; author: string; cover: string
  format: string; addedAt: number; lastReadAt: number
  totalReadingTime: number; progress: number
}

const B = 'http://127.0.0.1:34123'
const get = (p: string) => fetch(B + p).then(r => r.json()).catch(() => null)
const del = (p: string) => fetch(B + p, { method: 'DELETE' }).catch(() => {})

export async function getHistory(): Promise<HistoryEntry[]> {
  try { const items = await get('/api/history'); return (items || []).map((i: any) => ({ ...(typeof i.data === 'string' ? JSON.parse(i.data) : (i.data || i)), bookId: i.bookId || (typeof i.data === 'string' ? JSON.parse(i.data) : (i.data || {})).bookId })) } catch { return [] }
}
export async function upsertHistoryEntry(e: HistoryEntry): Promise<void> {
  await fetch(B + '/api/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId: e.bookId, data: JSON.stringify(e) }) }).catch(() => {})
}
export async function clearAllHistory(): Promise<void> { await del('/api/history') }
export async function clearDeletedHistory(existingIds?: Set<string>): Promise<void> {
  const items = await get('/api/history')
  if (!items || !Array.isArray(items)) return
  const toRemove = items.filter((i: any) => !existingIds?.has(i.bookId)).map((i: any) => i.bookId)
  if (toRemove.length > 0) { await del('/api/history?ids=' + encodeURIComponent(toRemove.join(','))) }
}
export async function removeHistoryEntries(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await del('/api/history?ids=' + encodeURIComponent(ids.join(',')))
}
