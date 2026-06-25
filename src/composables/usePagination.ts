import { ref, computed, watch, type Ref } from 'vue'

const PAGE_SIZES_KEY = 'pageSizes'

const defaultPageSizes: Record<string, number> = {
  bookshelf: 30,
  notes: 20,
  history: 20,
  trash: 20,
}

async function configGet(key: string): Promise<string | null> {
  if (typeof window !== 'undefined' && window.electronAPI?.config?.get) {
    return window.electronAPI.config.get(key).then((v: string | undefined | null) => v ?? null)
  }
  // Fallback: import Dexie db lazily
  const { db } = await import('@/services/db')
  const rec = await db.cfg.get(key)
  return rec?.v ?? null
}

export async function getPageSize(key: string): Promise<number> {
  try {
    const v = await configGet(PAGE_SIZES_KEY)
    if (v) {
      const sizes = JSON.parse(v)
      return sizes[key] || defaultPageSizes[key] || 20
    }
  } catch { /* fall through */ }
  return defaultPageSizes[key] || 20
}

export interface PaginationOptions {
  /** Optional callback invoked after the current page changes */
  onPageChange?: () => void
}

export function usePagination<T>(
  items: Ref<T[]>,
  pageSize: Ref<number> | number,
  opts?: PaginationOptions,
) {
  const currentPage = ref(1)

  const resolvedPageSize = computed(() =>
    typeof pageSize === 'number' ? pageSize : pageSize.value,
  )

  const totalPages = computed(() => {
    const size = resolvedPageSize.value
    if (size <= 0) return 1
    return Math.max(1, Math.ceil(items.value.length / size))
  })

  const pagedItems = computed(() => {
    const start = (currentPage.value - 1) * resolvedPageSize.value
    return items.value.slice(start, start + resolvedPageSize.value)
  })

  const hasNext = computed(() => currentPage.value < totalPages.value)
  const hasPrev = computed(() => currentPage.value > 1)

  // Reset to page 1 when page size changes
  watch(resolvedPageSize, () => {
    if (currentPage.value > totalPages.value) {
      currentPage.value = Math.max(1, totalPages.value)
    }
  })

  // Clamp current page when items shrink
  watch(() => items.value.length, () => {
    if (currentPage.value > totalPages.value) {
      currentPage.value = Math.max(1, totalPages.value)
    }
  })

  // Trigger onPageChange callback when page changes
  watch(currentPage, () => {
    if (opts?.onPageChange) opts.onPageChange()
  })

  function prevPage() { if (hasPrev.value) currentPage.value-- }
  function nextPage() { if (hasNext.value) currentPage.value++ }
  function goToPage(p: number) { currentPage.value = Math.max(1, Math.min(p, totalPages.value)) }
  function reset() { currentPage.value = 1 }

  return {
    currentPage,
    totalPages,
    hasPrev,
    hasNext,
    pagedItems,
    prevPage,
    nextPage,
    goToPage,
    reset,
  }
}
