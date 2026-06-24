import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Bookmark, Annotation, HighlightColor, ChapterContent } from '@/types'
import { db } from '@/services/db'
import { useSettingsStore } from './settings'

export const useReaderStore = defineStore('reader', () => {
  const bookId = ref('')
  const chapters = ref<ChapterContent[]>([])
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

  const currentChapter = computed(() => chapters.value[currentChapterIndex.value] || null)
  const chapterCount = computed(() => chapters.value.length)
  const hasPreviousChapter = computed(() => currentChapterIndex.value > 0)
  const hasNextChapter = computed(() => currentChapterIndex.value < chapters.value.length - 1)

  const currentChapterAnnotations = computed(() =>
    annotations.value.filter(a => a.chapterIndex === currentChapterIndex.value)
  )

  const currentChapterBookmarks = computed(() =>
    bookmarks.value.filter(b => b.chapterIndex === currentChapterIndex.value)
  )

  async function loadBook(bid: string) {
    bookId.value = bid
    scrollPosition.value = {}

    const chRecord = await db.ch.get(bid)
    if (chRecord) {
      chapters.value = JSON.parse(chRecord.data)
    }

    await loadBookmarks()
    await loadAnnotations()
  }

  async function loadBookmarks() {
    const records = await db.bm.filter(x => {
      try {
        const bm: Bookmark = JSON.parse(x.data)
        return bm.bookId === bookId.value
      } catch { return false }
    }).toArray()

    bookmarks.value = records.map(r => JSON.parse(r.data))
  }

  async function loadAnnotations() {
    const records = await db.ann.filter(x => {
      try {
        const ann: Annotation = JSON.parse(x.data)
        return ann.bookId === bookId.value
      } catch { return false }
    }).toArray()

    annotations.value = records.map(r => JSON.parse(r.data))
  }

  function navigateToChapter(index: number) {
    if (index >= 0 && index < chapters.value.length) {
      currentChapterIndex.value = index
    }
  }

  function previousChapter() {
    if (hasPreviousChapter.value) {
      currentChapterIndex.value--
    }
  }

  function nextChapter() {
    if (hasNextChapter.value) {
      currentChapterIndex.value++
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
    await db.bm.put({ id: bookmark.id, data: JSON.stringify(bookmark) })
    bookmarks.value.push(bookmark)
  }

  async function removeBookmark(id: string) {
    await db.bm.delete(id)
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
    await db.ann.put({ id: annotation.id, data: JSON.stringify(annotation) })
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
    await db.ann.put({ id: annotation.id, data: JSON.stringify(annotation) })
    annotations.value.push(annotation)
  }

  async function updateAnnotationNote(id: string, note: string) {
    const idx = annotations.value.findIndex(a => a.id === id)
    if (idx >= 0) {
      annotations.value[idx].note = note
      await db.ann.put({ id, data: JSON.stringify(annotations.value[idx]) })
    }
  }

  async function deleteAnnotation(id: string) {
    const idx = annotations.value.findIndex(a => a.id === id)
    if (idx >= 0) {
      await db.ann.delete(id)
      annotations.value = annotations.value.filter(a => a.id !== id)
    }
  }

  // In-chapter search
  function performSearch(query: string) {
    searchQuery.value = query
    searchResults.value = []
    currentSearchIndex.value = 0

    if (!query.trim()) return

    const q = query.toLowerCase()

    for (let ci = 0; ci < chapters.value.length; ci++) {
      const content = chapters.value[ci].content
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

  function generateId(): string {
    const timestamp = Date.now().toString(36)
    const random = crypto.getRandomValues(new Uint8Array(8))
    const randomStr = Array.from(random).map(b => b.toString(16).padStart(2, '0')).join('')
    return `${timestamp}-${randomStr}`
  }

  return {
    bookId, chapters, currentChapterIndex, scrollPosition,
    bookmarks, annotations,
    searchQuery, searchResults, currentSearchIndex,
    showSearch, showToc, showBookmarks, showAnnotations,
    isAutoScrolling, showToolbar,
    currentChapter, chapterCount,
    hasPreviousChapter, hasNextChapter,
    currentChapterAnnotations, currentChapterBookmarks,
    loadBook, navigateToChapter, previousChapter, nextChapter,
    saveScrollPosition, getScrollPosition,
    addBookmark, removeBookmark,
    addHighlight, addNote, updateAnnotationNote, deleteAnnotation,
    performSearch, clearSearch
  }
})
