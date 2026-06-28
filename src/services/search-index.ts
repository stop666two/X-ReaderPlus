/**
 * Inverted-index search engine for full-text search across all books.
 * Index is stored via electronAPI.config / localStorage under key `searchIndex`.
 *
 * Structure:
 *   {
 *     version: 1,
 *     words: { [word]: [{ bookId, chapterIndex, positions: number[] }] },
 *     books: { [bookId]: { title: string, chapterTitles: string[] } }
 *   }
 */

import { getAllMetas } from './metadata'
import type { ChapterContent, SearchResult } from '@/types'
import { logger } from './log'

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Chapters helper — uses electronAPI in Electron, falls back to Dexie in browser
// ---------------------------------------------------------------------------
async function getChapters(bid: string): Promise<string | null> {
  if (typeof window !== 'undefined' && window.electronAPI?.chapters) {
    return window.electronAPI.chapters.get(bid)
  }
  // Fallback: import Dexie db lazily
  const { db } = await import('./db')
  const record = await db.ch.get(bid)
  return record?.data ?? null
}

async function getAllChapterRecords(): Promise<Array<{ bid: string; data: string }>> {
  if (typeof window !== 'undefined' && window.electronAPI?.chapters) {
    return window.electronAPI.chapters.getAll()
  }
  const { db } = await import('./db')
  return db.ch.toArray()
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WordEntry {
  bookId: string
  chapterIndex: number
  positions: number[]
}

interface BookMeta {
  title: string
  chapterTitles: string[]
}

interface SearchIndexData {
  version: number
  words: Record<string, WordEntry[]>
  books: Record<string, BookMeta>
}

// ---------------------------------------------------------------------------
// Simple async mutex to guard concurrent index writes
// ---------------------------------------------------------------------------

class AsyncMutex {
  private _locked = false
  private _queue: (() => void)[] = []

  async acquire(): Promise<void> {
    if (!this._locked) {
      this._locked = true
      return
    }
    return new Promise<void>(resolve => {
      this._queue.push(resolve)
    })
  }

  release(): void {
    if (this._queue.length > 0) {
      const next = this._queue.shift()!
      next()
    } else {
      this._locked = false
    }
  }
}

const mutex = new AsyncMutex()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CFG_KEY = 'searchIndex'

async function loadIndex(): Promise<SearchIndexData | null> {
  const v = await configGet(CFG_KEY)
  if (!v) return null
  try {
    return JSON.parse(v) as SearchIndexData
  } catch {
    return null
  }
}

async function saveIndex(data: SearchIndexData): Promise<void> {
  await configSet(CFG_KEY, JSON.stringify(data))
}

function emptyIndex(): SearchIndexData {
  return { version: 1, words: {}, books: {} }
}

/** Tokenize a string into an array of lowercase tokens.
 *  - Chinese/CJK characters: each single char is a token, PLUS consecutive pairs (bigrams)
 *    are added for 2-char word matching (e.g. "中国" → ["中","中国","国"]).
 *  - Other scripts are split on whitespace/punctuation.
 *  - Tokens with length ≤ 1 are skipped. */
export function tokenize(text: string): string[] {
  const tokens: string[] = []
  let buf = ''
  let prevCjk: string | null = null // Track previous CJK char for bigram

  function flush() {
    const t = buf.trim().toLowerCase()
    if (t.length > 1) tokens.push(t)
    buf = ''
  }

  for (const ch of text) {
    // CJK Unified Ideographs + Extension A + some common range
    const code = ch.charCodeAt(0)
    if (
      (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified
      (code >= 0x3400 && code <= 0x4dbf) || // CJK Ext-A
      (code >= 0xf900 && code <= 0xfaff)     // CJK Compat
    ) {
      flush()
      tokens.push(ch.toLowerCase())
      // Generate bigram with previous CJK char for 2-char word matching
      if (prevCjk) {
        tokens.push(prevCjk + ch.toLowerCase())
      }
      prevCjk = ch.toLowerCase()
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      flush()
      prevCjk = null
      buf += ch
    } else {
      flush()
      prevCjk = null
    }
  }
  flush()
  return tokens
}

/** Strip HTML tags and decode common entities. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#?\w+;/g, '')
}

/** Tokenize text with position tracking. Returns word → [startPositions] map.
 *  Extracted to eliminate duplicate logic in buildIndex / rebuildFullIndex (M-5).
 *  Includes CJK bigrams for 2-char word matching. */
function tokenizeWithPositions(plainText: string): Map<string, number[]> {
  const wordPositions = new Map<string, number[]>()
  let buf = ''
  let bufStart = -1
  let prevCjk: { char: string; pos: number } | null = null

  function flushBuf() {
    const t = buf.trim().toLowerCase()
    if (t.length > 1 && bufStart >= 0) {
      const arr = wordPositions.get(t) || []
      arr.push(bufStart)
      wordPositions.set(t, arr)
    }
    buf = ''
    bufStart = -1
  }

  function addWord(word: string, pos: number) {
    const arr = wordPositions.get(word) || []
    arr.push(pos)
    wordPositions.set(word, arr)
  }

  for (let i = 0; i < plainText.length; i++) {
    const ch = plainText[i]
    const code = ch.charCodeAt(0)

    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0xf900 && code <= 0xfaff)
    ) {
      flushBuf()
      const lower = ch.toLowerCase()
      addWord(lower, i)
      // Generate CJK bigram with previous character
      if (prevCjk) {
        addWord(prevCjk.char + lower, prevCjk.pos)
      }
      prevCjk = { char: lower, pos: i }
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      if (bufStart < 0) bufStart = i
      buf += ch
      prevCjk = null
    } else {
      flushBuf()
      prevCjk = null
    }
  }
  flushBuf()
  return wordPositions
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build (or rebuild) the inverted index for a single book.
 * Call after importing a book or updating its chapters.
 */
export async function buildIndex(bookId: string, chapters: ChapterContent[]): Promise<void> {
  await mutex.acquire()
  try {
    let idx = await loadIndex()
    if (!idx) idx = emptyIndex()

    // Remove old entries for this book (if re-indexing)
    removeBookFromIndex(idx, bookId)

    // Book metadata
    idx.books[bookId] = {
      title: '', // will be filled by the caller via setBookMeta if needed
      chapterTitles: chapters.map(c => c.title)
    }

    // Build word → entries map
    for (let ci = 0; ci < chapters.length; ci++) {
      const plainText = stripHtml(chapters[ci].content)
      const wordPositions = tokenizeWithPositions(plainText)

      // Merge into global index
      for (const [word, positions] of wordPositions) {
        if (!idx.words[word]) idx.words[word] = []
        idx.words[word].push({ bookId, chapterIndex: ci, positions })
      }
    }

    await saveIndex(idx)
  } catch (e) {
    logger.error('构建搜索索引失败', e)
    throw e
  } finally {
    mutex.release()
  }
}

/**
 * Search the entire library (or a specific book) using the inverted index.
 */
export async function search(query: string, bookId?: string): Promise<SearchResult[]> {
  const idx = await loadIndex()
  if (!idx || !query.trim()) return []

  const q = query.trim().toLowerCase()
  const results: SearchResult[] = []

  // For exact phrase / substring matching, we delegate to a two-phase approach:
  // 1) Find candidate chapters via token overlap
  // 2) Verify substring match on the actual content
  //
  // Phase 1: token-based candidate filtering
  const tokens = tokenize(q)
  // Also allow raw substring search for short queries
  const candidateChapters = new Map<string, Set<number>>() // "bookId|chapterIndex" -> Set

  if (tokens.length > 0) {
    // Intersection: chapters that contain ALL query tokens
    let firstToken = true
    for (const token of tokens) {
      const entries = idx.words[token]
      if (!entries) {
        // One token not found → no matches
        return []
      }
      const chapterSet = new Set<string>()
      for (const e of entries) {
        if (bookId && e.bookId !== bookId) continue
        chapterSet.add(`${e.bookId}|${e.chapterIndex}`)
      }
      if (firstToken) {
        firstToken = false
        // Initialize candidateChapters with the first token's chapters
        for (const key of chapterSet) {
          candidateChapters.set(key, new Set())
        }
      } else {
        // Intersect
        for (const key of candidateChapters.keys()) {
          if (!chapterSet.has(key)) candidateChapters.delete(key)
        }
      }
      if (candidateChapters.size === 0) return []
    }
  } else {
    // No tokens (e.g. query is only short chars) — fall back to scanning all
    // books.  We'll handle this in phase 2 by loading chapters.
    // For now just return empty; the fallback in reader.ts will handle it.
    return []
  }

  // Phase 2: load chapter content and verify substring match
  for (const key of candidateChapters.keys()) {
    const [bid, ciStr] = key.split('|')
    const ci = parseInt(ciStr, 10)
    const bookMeta = idx.books[bid]
    if (!bookMeta) continue

    const chaptersRaw = await getChapters(bid)
    if (!chaptersRaw) continue

    let chapters: ChapterContent[]
    try {
      const parsed = JSON.parse(chaptersRaw)
      chapters = Array.isArray(parsed) ? parsed : parsed.chapters || []
    } catch {
      continue
    }
    if (!chapters[ci]) continue

    const plainText = stripHtml(chapters[ci].content).toLowerCase()
    let pos = plainText.indexOf(q)
    while (pos >= 0) {
      const start = Math.max(0, pos - 20)
      const end = Math.min(plainText.length, pos + q.length + 20)
      results.push({
        bookId: bid,
        bookTitle: bookMeta.title || '',
        chapterIndex: ci,
        chapterTitle: bookMeta.chapterTitles[ci] || chapters[ci].title || '',
        matchText: plainText.substring(start, end),
        matchPosition: pos
      })
      pos = plainText.indexOf(q, pos + 1)
    }
  }

  // Sort: prefer current book first if bookId is set
  if (bookId) {
    results.sort((a, b) => {
      if (a.bookId === bookId && b.bookId !== bookId) return -1
      if (a.bookId !== bookId && b.bookId === bookId) return 1
      return 0
    })
  }

  return results
}

/**
 * Remove a book's entries from the index.
 * Call after deleting a book.
 */
export async function removeBook(bookId: string): Promise<void> {
  await mutex.acquire()
  try {
    const idx = await loadIndex()
    if (!idx) return
    removeBookFromIndex(idx, bookId)
    await saveIndex(idx)
  } catch (e) {
    logger.error('移除搜索索引失败', e)
  } finally {
    mutex.release()
  }
}

/** Mutate `idx` in-place to remove all entries for `bookId`. */
function removeBookFromIndex(idx: SearchIndexData, bookId: string): void {
  for (const word of Object.keys(idx.words)) {
    idx.words[word] = idx.words[word].filter(e => e.bookId !== bookId)
    if (idx.words[word].length === 0) delete idx.words[word]
  }
  delete idx.books[bookId]
}

/**
 * Set/update book metadata (title) in the index.
 * Called after index is built to ensure book title is stored.
 */
export async function setBookMeta(bookId: string, title: string): Promise<void> {
  await mutex.acquire()
  try {
    const idx = await loadIndex()
    if (idx && idx.books[bookId]) {
      idx.books[bookId].title = title
      await saveIndex(idx)
    }
  } catch {
    // best-effort
  } finally {
    mutex.release()
  }
}

/**
 * Check whether the index exists and is non-empty.
 */
export async function indexExists(): Promise<boolean> {
  const idx = await loadIndex()
  return idx !== null && Object.keys(idx.words).length > 0
}

/**
 * Rebuild the entire index from scratch by iterating over all books.
 * This is called once on first launch (when no index exists).
 * Runs asynchronously and silently.
 */
export async function rebuildFullIndex(
  progressCallback?: (done: number, total: number) => void
): Promise<void> {
  await mutex.acquire()
  try {
    // Start fresh
    let idx = emptyIndex()
    await saveIndex(idx)

    const allMetas = await getAllMetas()
    const total = allMetas.length

    for (let i = 0; i < allMetas.length; i++) {
      const m = allMetas[i]
      if (!m?.bid) continue

      const chRecord = await getChapters(m.bid)
      if (!chRecord) continue

      let chapters: ChapterContent[]
      try {
        const parsed = JSON.parse(chRecord)
        chapters = Array.isArray(parsed) ? parsed : parsed.chapters || []
      } catch { continue }
      if (!chapters || chapters.length === 0) continue

      // Reload index after each book to avoid losing work (we need to re-acquire)
      // For efficiency we build in batches within the same lock
      const reloaded = await loadIndex()
      idx = reloaded ?? emptyIndex()

      // Book metadata
      idx.books[m.bid] = {
        title: m.title || '',
        chapterTitles: chapters.map(c => c.title)
      }

      for (let ci = 0; ci < chapters.length; ci++) {
        const plainText = stripHtml(chapters[ci].content)
        const wordPositions = tokenizeWithPositions(plainText)

        for (const [word, positions] of wordPositions) {
          if (!idx.words[word]) idx.words[word] = []
          idx.words[word].push({ bookId: m.bid, chapterIndex: ci, positions })
        }
      }

      await saveIndex(idx)
      progressCallback?.(i + 1, total)

      // Yield periodically to avoid blocking the UI
      if (i % 3 === 0) {
        await new Promise(r => setTimeout(r, 50))
      }
    }
  } catch (e) {
    logger.error('重建搜索索引失败', e)
    throw e
  } finally {
    mutex.release()
  }
}
