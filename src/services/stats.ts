const B = 'http://127.0.0.1:34123'
const get = (p: string) => fetch(B + p).then(r => r.json()).catch(() => null)
const post = (p: string, b: any) => fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).catch(() => {})
const del = (p: string) => fetch(B + p, { method: 'DELETE' }).catch(() => {})

export interface StatsEntry { bookId: string; title: string; author: string; cover: string; format: string; addedAt: number; lastReadAt: number; totalReadingTime: number; progress: number }
export interface DailyStat { date: string; minutesRead: number; booksOpened: number; pagesRead: number }

export async function upsertStatsEntry(_e: StatsEntry): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10)
    await post('/api/stats/upsert', { date: today, booksOpened: 1 })
  } catch {}
}
export async function getStats(): Promise<{ totalBooks: number; totalReadingTime: number; dailyStats: DailyStat[] }> {
  try { const items = await get('/api/stats') || []
    const daily: DailyStat[] = items.map((i: any) => { const d = typeof i.data === 'string' ? JSON.parse(i.data) : (i.data || i); return { date: d.date || i.date, minutesRead: d.minutesRead || 0, booksOpened: d.booksOpened || 0, pagesRead: d.pagesRead || 0 } })
    let totalBooks = 0; try { totalBooks = await get('/api/books/count') } catch {}
    return { totalBooks, totalReadingTime: daily.reduce((s: number, d: DailyStat) => s + d.minutesRead, 0), dailyStats: daily }
  } catch { return { totalBooks: 0, totalReadingTime: 0, dailyStats: [] } }
}
export async function getStatsData(): Promise<any[]> {
  try {
    const r = await get('/api/books?page=1&pageSize=200')
    const books = Array.isArray(r) ? r[0] || [] : []
    return books.map((b: any) => ({
      bookId: b.id || b.bookId,
      title: b.title || '',
      author: b.author || '',
      cover: b.cover || '',
      format: b.format || '',
      addedAt: b.addedAt || 0,
      lastReadAt: b.lastReadAt || 0,
      totalReadingTime: b.totalReadingTime || 0,
      progress: b.progress || 0,
    }))
  } catch { return [] }
}
export async function clearAllStats(): Promise<void> { await del('/api/stats') }
export async function clearDeletedStats(existingIds?: Set<string>): Promise<void> {
  if (!existingIds) return
  const items = await get('/api/stats')
  if (!items || !Array.isArray(items)) return
  const toRemove: string[] = []
  for (const i of items) {
    const d = typeof i.data === 'string' ? JSON.parse(i.data) : (i.data || i)
    const date = d.date || i.date
    if (date && existingIds.has(date)) { continue }
    toRemove.push(date)
  }
  if (toRemove.length > 0) {
    await del('/api/stats?dates=' + encodeURIComponent(toRemove.join(',')))
  }
}
