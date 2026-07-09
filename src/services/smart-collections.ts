import type { Book } from '@/types'

interface SmartCollection {
  id: string
  name: string
  icon: string
  filter: (book: Book) => boolean
}

const SMART_COLLECTIONS: SmartCollection[] = [
  {
    id: 'all',
    name: '全部书籍',
    icon: 'mdi-bookshelf',
    filter: () => true,
  },
  {
    id: 'unread',
    name: '未读',
    icon: 'mdi-book-outline',
    filter: (b) => b.progress === 0 || b.progress === undefined,
  },
  {
    id: 'reading',
    name: '正在阅读',
    icon: 'mdi-book-open-page-variant',
    filter: (b) => (b.progress ?? 0) > 0 && (b.progress ?? 0) < 1,
  },
  {
    id: 'finished',
    name: '已读完',
    icon: 'mdi-book-check',
    filter: (b) => (b.progress ?? 0) >= 1,
  },
  {
    id: 'recent',
    name: '最近添加',
    icon: 'mdi-clock-outline',
    filter: (b) => {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      return (b.addedAt ?? 0) > weekAgo
    },
  },
  {
    id: 'highRated',
    name: '高评分',
    icon: 'mdi-star',
    filter: (b) => (b.rating ?? 0) >= 4,
  },
  {
    id: 'favorites',
    name: '收藏',
    icon: 'mdi-heart',
    filter: (b) => (b.rating ?? 0) >= 5,
  },
]

export interface CollectionResult {
  collection: SmartCollection
  books: Book[]
  count: number
}

export function getSmartCollections(): SmartCollection[] {
  return SMART_COLLECTIONS
}

export function filterByCollection(books: Book[], collectionId: string): Book[] {
  const col = SMART_COLLECTIONS.find(c => c.id === collectionId)
  if (!col) return books
  return books.filter(col.filter)
}

export function getCollectionStats(books: Book[]): CollectionResult[] {
  return SMART_COLLECTIONS.map(col => {
    const filtered = books.filter(col.filter)
    return { collection: col, books: filtered, count: filtered.length }
  })
}

export function batchUpdateBooks(
  books: Book[],
  updates: Partial<Pick<Book, 'tags' | 'rating' | 'review'>>
): Book[] {
  return books.map(b => ({
    ...b,
    ...(updates.tags !== undefined ? { tags: updates.tags } : {}),
    ...(updates.rating !== undefined ? { rating: updates.rating } : {}),
    ...(updates.review !== undefined ? { review: updates.review } : {}),
  }))
}
