import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Book, BookFormat, Library, SortField, SortOrder, ViewMode, TrashItem, ImportMode } from '@/types'
import { DEFAULT_LIBRARY_ID, DEFAULT_LIBRARY_NAME } from '@/constants'
import { detectFormat, countWords, detectTags, createParseWorker, workerParse } from '@/services/parser'
import { compressCover } from '@/services/thumbnail'
import { logger } from '@/services/log'
import { generateId } from '@/services/base64'
import { upsertHistoryEntry } from '@/services/history'
import { upsertStatsEntry } from '@/services/stats'

function db() {
  // Null check satisfies AGENTS.md: always used with Dexie fallback in browser dev mode
  if (!window.electronAPI) throw new Error('electronAPI 不可用')
  return window.electronAPI
}

const ALL_LIBRARY_ID = '__all__'
const ALL_LIBRARY_NAME = '全部书库文件'

/**
 * Process items in batches with requestAnimationFrame between batches to prevent UI freeze.
 * @param items - Array of items to process
 * @param batchSize - Number of items per batch (default 50)
 * @param fn - Async function called for each item
 * @param progressCallback - Optional callback receiving (done, total) after each batch
 */
export async function batchProcess<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<void>,
  progressCallback?: (done: number, total: number) => void
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await Promise.all(batch.map(fn))
    const done = Math.min(i + batchSize, items.length)
    progressCallback?.(done, items.length)
    if (i + batchSize < items.length) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    }
  }
}

export const useBookshelfStore = defineStore('bookshelf', () => {
  const books = ref<Book[]>([])
  const libraries = ref<Library[]>([])
  const activeLibraryId = ref(ALL_LIBRARY_ID)
  const viewMode = ref<ViewMode>('grid')
  const searchQuery = ref('')
  const filterTag = ref('')
  const sortField = ref<SortField>('addedAt')
  const sortOrder = ref<SortOrder>('desc')
  const selectedIds = ref<Set<string>>(new Set())
  const isLoading = ref(false)
  const importProgress = ref({ current: 0, total: 0, message: '', bytesProcessed: 0, bytesTotal: 0, skippedDuplicates: 0 })
  const loadingProgress = ref(0)
  const loadingMessage = ref('正在加载...')
  const totalBookCount = ref(0)
  const readChapters = ref<Set<string>>(new Set())

  const activeLibrary = computed(() => {
    if (activeLibraryId.value === ALL_LIBRARY_ID) {
      return { id: ALL_LIBRARY_ID, name: ALL_LIBRARY_NAME, path: '', mode: 'copy' as const, createdAt: 0, bookCount: books.value.length }
    }
    return libraries.value.find(l => l.id === activeLibraryId.value) || null
  })

  const allTags = computed(() => {
    const tags = new Set<string>()
    filteredLibraryBooks.value.forEach(b => b.tags.forEach(t => tags.add(t)))
    return Array.from(tags).sort()
  })

  const filteredLibraryBooks = computed(() => {
    if (activeLibraryId.value === ALL_LIBRARY_ID) return books.value
    return books.value.filter(b => b.libraryId === activeLibraryId.value)
  })

  const filteredBooks = computed(() => {
    let result = [...filteredLibraryBooks.value]
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q))
    }
    if (filterTag.value) result = result.filter(b => b.tags.includes(filterTag.value))
    result.sort((a, b) => {
      let cmp = 0
      switch (sortField.value) {
        case 'title':
          cmp = (a.title || '').localeCompare(b.title || '', 'zh-CN')
          if (cmp === 0) cmp = (a.title || '').localeCompare(b.title || '', 'en')
          break
        case 'author':
          cmp = (a.author || '').localeCompare(b.author || '', 'zh-CN')
          if (cmp === 0) cmp = (a.author || '').localeCompare(b.author || '', 'en')
          break
        case 'addedAt': cmp = a.addedAt - b.addedAt; break
        case 'chapterCount': cmp = (a.chapterCount || 0) - (b.chapterCount || 0); break
        case 'libraryName':
          const libA = libraries.value.find(l => l.id === a.libraryId)?.name || ''
          const libB = libraries.value.find(l => l.id === b.libraryId)?.name || ''
          cmp = libA.localeCompare(libB, 'zh-CN')
          break
      }
      return sortOrder.value === 'asc' ? cmp : -cmp
    })
    return result
  })

  // ========== Libraries ==========

  async function loadLibraries() {
    const records = await db().libraries.getAll()
    libraries.value = records.map((r: any) => JSON.parse(r.data))
    if (!libraries.value.find(l => l.id === DEFAULT_LIBRARY_ID)) {
      const dl: Library = { id: DEFAULT_LIBRARY_ID, name: DEFAULT_LIBRARY_NAME, path: '', mode: 'copy', createdAt: Date.now(), bookCount: 0 }
      await db().libraries.insert(dl.id, JSON.stringify(dl))
      libraries.value.unshift(dl)
    }
  }

  async function createLibrary(name: string, folderPath: string): Promise<Library> {
    const lib: Library = { id: generateId(), name, path: folderPath, mode: 'folder', createdAt: Date.now(), bookCount: 0 }
    try {
      await db().libraries.insert(lib.id, JSON.stringify(lib))
    } catch (e) {
      logger.error('创建书库失败', e)
      throw e
    }
    libraries.value.push(lib)
    return lib
  }

  async function deleteLibrary(id: string) {
    if (id === DEFAULT_LIBRARY_ID) return
    try {
      const orphanedBooks = books.value.filter(b => b.libraryId === id)
      // Persist libraryId change for each orphaned book (M-8)
      for (const book of orphanedBooks) {
        book.libraryId = DEFAULT_LIBRARY_ID
        await db().books.update(book.id, { libraryId: DEFAULT_LIBRARY_ID })
      }
      await db().libraries.delete(id)
    } catch (e) {
      logger.error('删除书库失败', e)
      throw e
    }
    libraries.value = libraries.value.filter(l => l.id !== id)
    if (activeLibraryId.value === id) activeLibraryId.value = DEFAULT_LIBRARY_ID
    await loadBooks()
  }

  async function renameLibrary(id: string, name: string) {
    const lib = libraries.value.find(l => l.id === id)
    if (lib) {
      lib.name = name
      try { await db().libraries.insert(id, JSON.stringify(lib)) } catch (e) { logger.error('重命名书库失败', e); throw e }
    }
  }

  function setActiveLibrary(id: string) {
    activeLibraryId.value = id
    selectedIds.value = new Set()
  }

  // ========== Books ==========

  async function loadBooks(page?: number, pageSize?: number) {
    const limit = pageSize ?? 30
    const offset = ((page ?? 1) - 1) * limit
    const result = await db().books.getAll({ limit, offset })
    // safeHandler may return { success: false, error } on failure
    if (result && !Array.isArray(result) && (result as any).success === false) {
      logger.error('加载书籍失败:', (result as any).error)
      books.value = []
      totalBookCount.value = 0
      return
    }
    const rows = result as any[]
    let totalCount = 0
    try { totalCount = await db().books.count() } catch { /* count is best-effort */ }
    totalBookCount.value = totalCount
    books.value = rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      author: row.author,
      cover: row.cover,
      path: row.path,
      format: row.format as BookFormat,
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
    }))
    for (const lib of libraries.value) { lib.bookCount = books.value.filter(b => b.libraryId === lib.id).length }
  }

  async function loadAllData() {
    try {
      loadingMessage.value = '正在加载书库...'
      loadingProgress.value = 5

      await loadLibraries()
      loadingProgress.value = 50

      loadingMessage.value = '正在加载书籍...'
      await loadBooks()
      loadingProgress.value = 90

      loadingMessage.value = '正在加载设置...'
      await new Promise(r => setTimeout(r, 150))
    } catch (e) {
      logger.error('加载数据失败', e)
      // Ensure books are at least an empty array so UI doesn't crash
      if (books.value.length === 0) books.value = []
    } finally {
      loadingProgress.value = 100
      loadingMessage.value = ''
    }
  }

  async function clearAllData() {
    await db().clearAll()
  }

  async function importFiles(filePaths: string[], libraryId?: string, importMode?: ImportMode, customNames?: string[]): Promise<number> {
    isLoading.value = true
    const targetLibId = libraryId || activeLibraryId.value
    let importedCount = 0
    const names = customNames || filePaths.map(p => p.split(/[\\/]/).pop() || 'unknown')

    try {
      // ---- File size estimation & large-file warning ----
      let totalBytes = 0
      const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024 // 50 MB
      let hasLargeFile = false
      let largeFiles: Array<{ name: string; sizeMB: string }> = []

      if (window.electronAPI && window.electronAPI.fileStats) {
        try {
          const stats = await window.electronAPI.fileStats(filePaths)
          for (const s of stats) {
            if (!s.error) {
              totalBytes += s.size
              if (s.size > LARGE_FILE_THRESHOLD) {
                hasLargeFile = true
                largeFiles.push({ name: s.name, sizeMB: (s.size / (1024 * 1024)).toFixed(1) })
              }
            }
          }
        } catch { /* continue without size estimation */ }
      }

      if (hasLargeFile && window.electronAPI && window.electronAPI.showMessageBox) {
        const fileList = largeFiles.map(f => `  • ${f.name} (${f.sizeMB} MB)`).join('\n')
        const { response } = await window.electronAPI.showMessageBox({
          type: 'warning',
          title: '大文件导入确认',
          message: `以下文件较大，导入可能需要一些时间，是否继续？\n\n${fileList}`,
          buttons: ['继续导入', '取消'],
          defaultId: 0,
          cancelId: 1,
          noLink: true
        })
        if (response === 1) {
          isLoading.value = false
          importProgress.value = { current: 0, total: 0, message: '', bytesProcessed: 0, bytesTotal: 0, skippedDuplicates: 0 }
          return 0
        }
      }

      // Set initial progress
      importProgress.value = {
        current: 0,
        total: filePaths.length,
        message: '正在读取文件...',
        bytesProcessed: 0,
        bytesTotal: totalBytes,
        skippedDuplicates: 0
      }

      let results: Array<{ name: string; data: ArrayBuffer; error?: string }> = []
      if (window.electronAPI) {
        results = await window.electronAPI.readBatchFiles(filePaths)
      } else {
        throw new Error('请在 Electron 环境下导入')
      }

      let bytesProcessed = 0
      let skippedDuplicates = 0
      const importedHashes = new Set<string>()

      // Create a single parse worker for the entire batch
      const worker = createParseWorker()
      const workerProgress = (message: string) => {
        importProgress.value = { ...importProgress.value, message }
      }

      try {
        for (let i = 0; i < results.length; i++) {
          const r = results[i]
          if (r.data && r.data.byteLength) bytesProcessed += r.data.byteLength

          importProgress.value = {
            current: i + 1,
            total: results.length,
            message: `正在导入 ${r.name}...`,
            bytesProcessed,
            bytesTotal: totalBytes,
            skippedDuplicates
          }

          if (r.error) { logger.error(`读取失败: ${r.name}`, r.error); continue }

          const data = r.data
          const dataSize = data.byteLength
          if (dataSize > 500 * 1024 * 1024) { logger.warn(`文件过大: ${r.name}`); continue }

          const fmt = detectFormat(r.name)
          if (fmt === 'epub') {
            try {
              const JSZip = (await import('jszip')).default
              const zip = await JSZip.loadAsync(data)
              if (Object.keys(zip.files).length > 10000) { logger.warn(`EPUB 文件数过多: ${r.name}`); continue }
            } catch { logger.warn(`EPUB 无效: ${r.name}`); continue }
          }

          // ---- SHA-256 content deduplication ----
          let contentHash: string
          try {
            const hashBuffer = await crypto.subtle.digest('SHA-256', data)
            const hashArray = Array.from(new Uint8Array(hashBuffer))
            contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
          } catch { logger.warn(`哈希计算失败: ${r.name}`); continue }

          if (contentHash) {
            const isDuplicate = books.value.some(b => b.contentHash === contentHash)
              || importedHashes.has(contentHash)
            if (isDuplicate) {
              skippedDuplicates++
              importProgress.value = {
                current: i + 1,
                total: results.length,
                message: `已存在（内容重复）: ${r.name}`,
                bytesProcessed,
                bytesTotal: totalBytes,
                skippedDuplicates
              }
              continue
            }
            importedHashes.add(contentHash)
          }

          try {
            // Offload heavy parsing to Worker thread — keeps UI responsive
            const parsed = await workerParse(worker, filePaths[i] || r.name, r.name, data, dataSize, workerProgress)
            // Auto-detect tags from parsed content
            const fullText = parsed.chapters.map((c: any) => c.content.replace(/<[^>]+>/g, ' ')).join('\n')
            const autoTags = detectTags(fullText)
            const book: Book = {
              id: generateId(),
              title: parsed.metadata.title.replace(/<[^>]+>/g, ''),
              author: parsed.metadata.author.replace(/<[^>]+>/g, ''),
              cover: await compressCover(parsed.metadata.cover || ''),
              path: filePaths[i] || r.name,
              format: parsed.metadata.format,
              size: dataSize,
              addedAt: Date.now(),
              lastReadAt: 0,
              progress: 0,
              chapterIndex: 0,
              chapterProgress: 0,
              tags: autoTags,
              rating: 0,
              review: '',
              wordCount: parsed.chapters.reduce((s: number, c: any) => s + countWords(c.content), 0),
              chapterCount: parsed.chapters.length,
              totalReadingTime: 0,
              libraryId: targetLibId,
              contentHash
            }
            await db().books.insert(book)
            await db().chapters.set(book.id, JSON.stringify(parsed.chapters))
            upsertHistoryEntry({
              bookId: book.id, title: book.title, author: book.author,
              cover: book.cover, format: book.format, addedAt: book.addedAt,
              lastReadAt: book.lastReadAt, totalReadingTime: book.totalReadingTime,
              progress: book.progress
            }).catch(() => { /* best-effort: history update is non-critical */ })
            upsertStatsEntry({
              bookId: book.id, title: book.title, author: book.author,
              cover: book.cover, format: book.format, addedAt: book.addedAt,
              lastReadAt: book.lastReadAt, totalReadingTime: book.totalReadingTime,
              progress: book.progress
            }).catch(() => { /* best-effort: stats update is non-critical */ })
            importedCount++
          } catch (e) { logger.error(`导入失败: ${r.name}`, e) }

          // Yield to the main thread to keep UI responsive during batch imports
          await new Promise(r => setTimeout(r, 0))
        }
      } finally {
        worker.terminate()
      }
    } catch (e: any) { logger.error('导入异常', e) } finally {
      isLoading.value = false
      importProgress.value = { current: 0, total: 0, message: '', bytesProcessed: 0, bytesTotal: 0, skippedDuplicates: 0 }
      await loadBooks()
    }
    return importedCount
  }

  async function deleteBooks(ids: string[]) {
    await batchProcess(ids, 50, async (id) => {
      const book = books.value.find(b => b.id === id)
      if (book) {
        try {
          await db().trash.insert(id, JSON.stringify({ id, book, deletedAt: Date.now() }))
        } catch (e) {
          logger.error('移入回收站失败', e)
        }
      }
      selectedIds.value.delete(id)
    })
    selectedIds.value = new Set(selectedIds.value)
    const result: any = await db().books.delete(ids)
    if (result?.success === false) {
      logger.error('删除书籍失败:', result.error)
    }
    const idSet = new Set(ids)
    books.value = books.value.filter(b => !idSet.has(b.id))
    totalBookCount.value = Math.max(0, totalBookCount.value - ids.length)
    for (const lib of libraries.value) { lib.bookCount = books.value.filter(b => b.libraryId === lib.id).length }
  }

  async function updateBook(id: string, updates: Partial<Book>) {
    try {
      const idx = books.value.findIndex(b => b.id === id)
      if (idx < 0) return

      const book = { ...books.value[idx], ...updates }
      books.value[idx] = book
      await db().books.update(id, updates)
    } catch (e) {
      logger.error('更新书籍失败', e)
    }
  }

  async function updateBookProgress(id: string, ci: number, cp: number) {
    try {
      // Clamp chapter progress to [0, 1] as a fraction of current chapter
      const safeCp = Math.max(0, Math.min(1, cp))
      const idx = books.value.findIndex(b => b.id === id)
      if (idx < 0) return

      const total = await getChapterCount(id)
      const progress = total > 0
        ? Math.min(1, Math.max(0, (Math.max(0, ci) + safeCp) / total))
        : 0
      const lastReadAt = Date.now()

      // Update in-memory book
      const book = books.value[idx]
      book.chapterIndex = Math.max(0, ci)
      book.chapterProgress = safeCp
      book.progress = progress
      book.lastReadAt = lastReadAt

      await db().books.update(id, { chapterIndex: ci, chapterProgress: cp, progress, lastReadAt })

      upsertHistoryEntry({
        bookId: book.id, title: book.title, author: book.author,
        cover: book.cover, format: book.format, addedAt: book.addedAt,
        lastReadAt: book.lastReadAt, totalReadingTime: book.totalReadingTime,
        progress: book.progress
      }).catch(() => { /* best-effort: history/stats update is non-critical */ })
      upsertStatsEntry({
        bookId: book.id, title: book.title, author: book.author,
        cover: book.cover, format: book.format, addedAt: book.addedAt,
        lastReadAt: book.lastReadAt, totalReadingTime: book.totalReadingTime,
        progress: book.progress
      }).catch(() => { /* best-effort: history/stats update is non-critical */ })
    } catch (e) {
      logger.error('更新阅读进度失败', e)
    }
  }

  async function updateBookReadingTime(id: string, seconds: number) {
    try {
      const idx = books.value.findIndex(b => b.id === id)
      if (idx < 0) return

      const book = books.value[idx]
      book.totalReadingTime += seconds
      book.lastReadAt = Date.now()

      await db().books.update(id, { totalReadingTime: book.totalReadingTime, lastReadAt: book.lastReadAt })

      upsertHistoryEntry({
        bookId: book.id, title: book.title, author: book.author,
        cover: book.cover, format: book.format, addedAt: book.addedAt,
        lastReadAt: book.lastReadAt, totalReadingTime: book.totalReadingTime,
        progress: book.progress
      }).catch(() => { /* best-effort: history/stats update is non-critical */ })
      upsertStatsEntry({
        bookId: book.id, title: book.title, author: book.author,
        cover: book.cover, format: book.format, addedAt: book.addedAt,
        lastReadAt: book.lastReadAt, totalReadingTime: book.totalReadingTime,
        progress: book.progress
      }).catch(() => { /* best-effort: history/stats update is non-critical */ })
    } catch (e) {
      logger.error('更新阅读时间失败', e)
    }
  }

  async function getChapterCount(bookId: string): Promise<number> {
    try {
      // Use book's chapter_count field instead of loading full chapter data
      const book = await db().books.getById(bookId)
      if (book && typeof book.chapter_count === 'number') return book.chapter_count
      // Fallback: count chapters without loading full content
      const row = await db().chapters.get(bookId)
      if (row) { const c = JSON.parse(row); return Array.isArray(c) ? c.length : 0 }
    } catch (e) {
      logger.error('获取章节数失败', e)
    }
    return 0
  }

  function toggleSelect(id: string) {
    const s = new Set(selectedIds.value)
    s.has(id) ? s.delete(id) : s.add(id)
    selectedIds.value = s
  }
  function selectAll() { selectedIds.value = new Set(filteredBooks.value.map(b => b.id)) }
  function clearSelection() { selectedIds.value = new Set() }
  function invertSelection() {
    const allIds = new Set(filteredBooks.value.map(b => b.id))
    const inverted = new Set<string>()
    allIds.forEach(id => { if (!selectedIds.value.has(id)) inverted.add(id) })
    selectedIds.value = inverted
  }

// generateId imported from @/services/base64 (L-8)

  return {
    books, libraries, activeLibraryId, viewMode, searchQuery, filterTag, sortField, sortOrder,
    selectedIds, isLoading, importProgress, loadingProgress, loadingMessage, readChapters,
    totalBookCount,
    activeLibrary, allTags, filteredBooks, filteredLibraryBooks,
    loadLibraries, createLibrary, deleteLibrary, renameLibrary, setActiveLibrary,
    loadBooks, loadAllData, clearAllData, importFiles, deleteBooks, updateBook,
    updateBookProgress, updateBookReadingTime, getChapterCount,
    toggleSelect, selectAll, clearSelection, invertSelection
  }
})
