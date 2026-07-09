import { defineStore } from 'pinia'
import { ref, shallowRef, triggerRef, computed } from 'vue'
import type { Bookmark, Annotation, HighlightColor, ChapterContent, TocItem, ReadingMode, Book } from '@/types'
import { useSettingsStore } from './settings'
import { useBookshelfStore } from './bookshelf'
import { BASE } from '@/services/api-bridge'
import { generateId } from '@/services/base64'
import { search as indexSearch, indexExists } from '@/services/search-index'
import { sha256 } from '@/services/integrity'

export const useReaderStore = defineStore('reader', () => {
  const bookId = ref('')
  /** Chapter metadata (title only — content is lazy-loaded) */
  const chapters = ref<ChapterContent[]>([])
  /** Table of Contents from EPUB NCX/nav or other format TOC data */
  const rawToc = ref<TocItem[]>([])
  const currentChapterIndex = ref(0)
  const scrollPosition = ref<Record<number, number>>({})
  const bookmarks = ref<Bookmark[]>([])
  const annotations = ref<Annotation[]>([])
  const searchQuery = ref('')
  const searchResults = ref<Array<{ chapterIndex: number; matchIndex: number; text: string }>>([])
  const currentSearchIndex = ref(0)
  const showSearch = ref(false)
  const showToc = ref(false)
  const showBookmarks = ref(false)
  const showAnnotations = ref(false)
  const isAutoScrolling = ref(false)
  const showToolbar = ref(true)
  const readingMode = ref<ReadingMode>('scroll')
  const autoScrollSpeed = ref(50) // px/s
  const currentPage = ref(0)
  const totalPages = ref(1)
  const pageHeights = ref<number[]>([])

  // Content integrity: null = unchecked, true = ok, false = tampered, 'unavailable' = no raw file
  const contentIntegrity = ref<boolean | 'unavailable' | null>(null)

  // Lazy chapter content cache
  let _allChapterData: ChapterContent[] | null = null
  const chapterContents = shallowRef<Map<number, string>>(new Map())

  const currentChapter = computed(() => {
    const meta = chapters.value[currentChapterIndex.value]
    if (!meta) return null
    return {
      title: meta.title,
      content: chapterContents.value.get(currentChapterIndex.value) || ''
    }
  })
  const chapterCount = computed(() => chapters.value.length)
  const hasPreviousChapter = computed(() => currentChapterIndex.value > 0)
  const hasNextChapter = computed(() => currentChapterIndex.value < chapters.value.length - 1)

  const currentChapterAnnotations = computed(() =>
    annotations.value.filter(a => a.chapterIndex === currentChapterIndex.value)
  )

  const currentChapterBookmarks = computed(() =>
    bookmarks.value.filter(b => b.chapterIndex === currentChapterIndex.value)
  )

  /** Load chapter content on demand, with neighbor preloading and cache eviction */
  async function loadChapterContent(index: number): Promise<void> {
    if (!_allChapterData || index < 0 || index >= _allChapterData.length) return
    const data = _allChapterData[index]
    chapterContents.value.set(index, data.content)
    triggerRef(chapterContents)

    // Preload adjacent chapters in background, then evict distant ones
    setTimeout(() => {
      // Guard: _allChapterData may have been set to null by loadBook() in the meantime
      if (!_allChapterData) return
      if (index + 1 < _allChapterData.length) {
        chapterContents.value.set(index + 1, _allChapterData[index + 1].content)
      }
      if (index - 1 >= 0) {
        chapterContents.value.set(index - 1, _allChapterData[index - 1].content)
      }
      // Evict chapters more than 3 away from current
      for (const [i] of chapterContents.value) {
        if (Math.abs(i - index) > 3) {
          chapterContents.value.delete(i)
        }
      }
      triggerRef(chapterContents)
    }, 50)
  }

async function loadBook(bid: string) {
  bookId.value = bid
  scrollPosition.value = {}
  chapterContents.value = new Map()
  triggerRef(chapterContents)
  _allChapterData = null
  contentIntegrity.value = null

  if (!window.electronAPI) return
  const data = await window.electronAPI.chapters.get(bid)
  if (data) {
    const parsed = JSON.parse(data)
    let allChapters: ChapterContent[]
    let toc: TocItem[]
    if (Array.isArray(parsed)) {
      allChapters = parsed
      toc = allChapters.map((c, i) => ({ label: c.title, href: '', chapterIndex: i }))
    } else {
      allChapters = (parsed as any).chapters || []
      toc = (parsed as any).rawToc || (() => {
        const ch = (parsed as any).chapters || []
        return ch.map((c: ChapterContent, i: number) => ({ label: c.title, href: '', chapterIndex: i }))
      })()
    }
    _allChapterData = allChapters
    chapters.value = allChapters.map(ch => ({ title: ch.title, content: '' }))
    rawToc.value = toc

    // Verify content integrity against original file hash
    const book = useBookshelfStore().books.find(b => b.id === bid)
    if (book?.contentHash) {
      try {
        const rawRes = await fetch(`${BASE}/api/raw/${bid}`)
        if (rawRes.ok) {
          const rawData = await rawRes.arrayBuffer()
          const rawHash = await sha256(rawData)
          contentIntegrity.value = rawHash === book.contentHash
        } else {
          contentIntegrity.value = 'unavailable'
        }
      } catch {
        contentIntegrity.value = 'unavailable'
      }
    } else {
      contentIntegrity.value = 'unavailable'
    }
  } else {
    chapters.value = []
    rawToc.value = []
  }

  try { await loadBookmarks() } catch { bookmarks.value = [] }
  try { await loadAnnotations() } catch { annotations.value = [] }
}

async function loadBookmarks() {
    if (!window.electronAPI) return
    const records = await window.electronAPI.bookmarks.getByBook(bookId.value)
    bookmarks.value = records.map((r: any) => {
      try { return JSON.parse(r.data) } catch { return null }
    }).filter(Boolean)
  }

  async function loadAnnotations() {
    if (!window.electronAPI) return
    const records = await window.electronAPI.annotations.getByBook(bookId.value)
    annotations.value = records.map((r: any) => {
      try { return JSON.parse(r.data) } catch { return null }
    }).filter(Boolean)
  }

  function navigateToChapter(index: number) {
    if (index >= 0 && index < chapters.value.length) {
      currentChapterIndex.value = index
      loadChapterContent(index)
    }
  }

  function previousChapter() {
    if (hasPreviousChapter.value) {
      currentChapterIndex.value--
      loadChapterContent(currentChapterIndex.value)
    }
  }

  function nextChapter() {
    if (hasNextChapter.value) {
      currentChapterIndex.value++
      loadChapterContent(currentChapterIndex.value)
    }
  }

  function saveScrollPosition(chapterIndex: number, position: number) {
    scrollPosition.value[chapterIndex] = position
  }

  function getScrollPosition(chapterIndex: number): number {
    return scrollPosition.value[chapterIndex] || 0
  }

  // Bookmarks
  async function addBookmark(name: string, paragraphOffset: number) {
    const bookmark: Bookmark = {
      id: generateId(),
      bookId: bookId.value,
      name,
      chapterIndex: currentChapterIndex.value,
      paragraphOffset,
      createdAt: Date.now()
    }
    if (!window.electronAPI) return
    await window.electronAPI.bookmarks.insert(bookmark.id, JSON.stringify(bookmark))
    bookmarks.value.push(bookmark)
  }

  async function removeBookmark(id: string) {
    if (!window.electronAPI) return
    await window.electronAPI.bookmarks.delete(id)
    bookmarks.value = bookmarks.value.filter(b => b.id !== id)
  }

  // Annotations
  async function addHighlight(startOffset: number, endOffset: number, text: string, color: HighlightColor) {
    const annotation: Annotation = {
      id: generateId(),
      bookId: bookId.value,
      type: 'highlight',
      color,
      chapterIndex: currentChapterIndex.value,
      startOffset,
      endOffset,
      text,
      note: '',
      tags: [],
      createdAt: Date.now()
    }
    if (!window.electronAPI) return
    await window.electronAPI.annotations.insert(annotation.id, JSON.stringify(annotation))
    annotations.value.push(annotation)
  }

  async function addNote(startOffset: number, endOffset: number, text: string, noteContent: string) {
    const annotation: Annotation = {
      id: generateId(),
      bookId: bookId.value,
      type: 'note',
      color: 'yellow',
      chapterIndex: currentChapterIndex.value,
      startOffset,
      endOffset,
      text,
      note: noteContent,
      tags: [],
      createdAt: Date.now()
    }
    if (!window.electronAPI) return
    await window.electronAPI.annotations.insert(annotation.id, JSON.stringify(annotation))
    annotations.value.push(annotation)
  }

  async function updateAnnotationNote(id: string, note: string) {
    const idx = annotations.value.findIndex(a => a.id === id)
    if (idx >= 0) {
      annotations.value[idx].note = note
      if (!window.electronAPI) return
      await window.electronAPI.annotations.update(id, JSON.stringify(annotations.value[idx]))
    }
  }

  async function deleteAnnotation(id: string) {
    const idx = annotations.value.findIndex(a => a.id === id)
    if (idx >= 0) {
      if (!window.electronAPI) return
      await window.electronAPI.annotations.delete(id)
      annotations.value = annotations.value.filter(a => a.id !== id)
    }
  }

  // In-chapter search — uses inverted index when available, falls back to linear scan
  async function performSearch(query: string) {
    searchQuery.value = query
    searchResults.value = []
    currentSearchIndex.value = 0

    if (!query.trim()) return

    const q = query.toLowerCase()

    // Try inverted index first
    try {
      const hasIndex = await indexExists()
      if (hasIndex) {
        const results = await indexSearch(q, bookId.value)
        searchResults.value = results.map((r, i) => ({
          chapterIndex: r.chapterIndex,
          matchIndex: i,
          text: r.matchText
        }))
        return
      }
    } catch {
      // Index lookup failed, fall through to linear scan
    }

    // Fallback: linear scan using _allChapterData (has full content)
    if (!_allChapterData) return
    for (let ci = 0; ci < _allChapterData.length; ci++) {
      const content = _allChapterData[ci].content
      if (!content) continue
      const stripped = content.replace(/<[^>]+>/g, '').toLowerCase()
      let idx = stripped.indexOf(q)
      while (idx >= 0) {
        const start = Math.max(0, idx - 20)
        const end = Math.min(stripped.length, idx + q.length + 20)
        searchResults.value.push({
          chapterIndex: ci,
          matchIndex: searchResults.value.length,
          text: stripped.substring(start, end)
        })
        idx = stripped.indexOf(q, idx + 1)
      }
    }
  }

  function clearSearch() {
    searchQuery.value = ''
    searchResults.value = []
    currentSearchIndex.value = 0
    showSearch.value = false
  }

  function setReadingMode(mode: ReadingMode) {
    readingMode.value = mode
    if (mode === 'scroll') stopAutoScroll()
    if (mode === 'pagination') {
      stopAutoScroll()
      currentPage.value = 0
    }
  }

  /** Paginate chapter content into page-sized segments */
  function paginateChapter(html: string, containerHeight: number) {
    const div = document.createElement('div')
    div.style.cssText = 'position:absolute;visibility:hidden;width:100%'
    div.innerHTML = html
    document.body.appendChild(div)
    try {
      const heights: number[] = []
      let running = 0
      for (const child of Array.from(div.children)) {
        const h = (child as HTMLElement).offsetHeight
        if (running + h > containerHeight && running > 0) {
          heights.push(running)
          running = h
        } else {
          running += h
        }
      }
      if (running > 0) heights.push(running)
      pageHeights.value = heights
      totalPages.value = Math.max(1, heights.length)
      return heights
    } finally {
      if (div.parentNode) div.parentNode.removeChild(div)
    }
  }

  function nextPage() {
    if (currentPage.value < totalPages.value - 1) currentPage.value++
  }

  function prevPage() {
    if (currentPage.value > 0) currentPage.value--
  }

  let _autoTimer: ReturnType<typeof setInterval> | null = null
  function toggleAutoScroll(container: HTMLElement | null) {
    if (isAutoScrolling.value) {
      stopAutoScroll()
    } else {
      startAutoScroll(container)
    }
  }

  function startAutoScroll(container: HTMLElement | null) {
    if (!container || _autoTimer) return
    isAutoScrolling.value = true
    _autoTimer = setInterval(() => {
      container.scrollTop += autoScrollSpeed.value / 60
    }, 16)
  }

  function stopAutoScroll() {
    isAutoScrolling.value = false
    if (_autoTimer) { clearInterval(_autoTimer); _autoTimer = null }
  }

  return {
    bookId, chapters, rawToc, currentChapterIndex, scrollPosition,
    bookmarks, annotations,
    searchQuery, searchResults, currentSearchIndex,
    showSearch, showToc, showBookmarks, showAnnotations,
    isAutoScrolling, showToolbar, contentIntegrity,
    readingMode, autoScrollSpeed, currentPage, totalPages, pageHeights,
    currentChapter, chapterCount,
    hasPreviousChapter, hasNextChapter,
    currentChapterAnnotations, currentChapterBookmarks,
    loadBook, navigateToChapter, previousChapter, nextChapter,
    saveScrollPosition, getScrollPosition,
    loadChapterContent,
    addBookmark, removeBookmark,
    addHighlight, addNote, updateAnnotationNote, deleteAnnotation,
    performSearch, clearSearch,
    setReadingMode, paginateChapter, nextPage, prevPage,
    toggleAutoScroll, startAutoScroll, stopAutoScroll
  }
})
