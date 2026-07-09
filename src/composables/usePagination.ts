import { ref, computed, watch, type Ref } from 'vue'

const PAGE_SIZES_KEY = 'pageSizes'

const defaultPageSizes: Record<string, number> = {
  bookshelf: 30,
  notes: 20,
  history: 20,
  trash: 20,
}

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100]

async function configGet(key: string): Promise<string | null> {
  if (typeof window !== 'undefined' && window.electronAPI?.config?.get) {
    return window.electronAPI.config.get(key).then((v: string | undefined | null) => v ?? null)
  }
  return null
}

async function configSet(key: string, value: string): Promise<void> {
  if (typeof window !== 'undefined' && window.electronAPI?.config?.set) {
    return window.electronAPI.config.set(key, value)
  }
}

export async function getPageSize(key: string): Promise<number> {
  try {
    const v = await configGet(PAGE_SIZES_KEY)
    if (v) {
      const sizes = JSON.parse(v)
      return sizes[key] || defaultPageSizes[key] || 20
    }
  } catch { }
  return defaultPageSizes[key] || 20
}

export interface PaginationOptions {
  onPageChange?: () => void
}

export function usePagination<T>(
  items: Ref<T[]>,
  pageSize: Ref<number> | number,
  opts?: PaginationOptions,
) {
  const currentPage = ref(1)
  const loading = ref(false)

  const resolvedPageSize = computed(() =>
    typeof pageSize === 'number' ? pageSize : pageSize.value,
  )

  const totalItems = computed(() => items.value.length)

  const totalPages = computed(() => {
    const size = resolvedPageSize.value
    if (size <= 0) return 1
    return Math.max(1, Math.ceil(totalItems.value / size))
  })

  const pagedItems = computed(() => {
    const size = resolvedPageSize.value
    if (size <= 0) return items.value
    const start = (currentPage.value - 1) * size
    return items.value.slice(start, start + size)
  })

  const hasNext = computed(() => currentPage.value < totalPages.value)
  const hasPrev = computed(() => currentPage.value > 1)

  const pageInfoText = computed(() => {
    const size = resolvedPageSize.value
    if (totalItems.value === 0) return '0 条'
    const start = (currentPage.value - 1) * size + 1
    const end = Math.min(currentPage.value * size, totalItems.value)
    return `${start}-${end} / ${totalItems.value} 条`
  })

  const visiblePages = computed(() => {
    const total = totalPages.value
    const current = currentPage.value
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    const pages: (number | '...')[] = [1]
    const start = Math.max(2, current - 2)
    const end = Math.min(total - 1, current + 2)
    if (start > 2) pages.push('...')
    for (let i = start; i <= end; i++) pages.push(i)
    if (end < total - 1) pages.push('...')
    if (total > 1) pages.push(total)
    return pages
  })

  watch(resolvedPageSize, () => {
    if (currentPage.value > totalPages.value) {
      currentPage.value = Math.max(1, totalPages.value)
    }
  })

  watch(() => items.value.length, () => {
    if (currentPage.value > totalPages.value) {
      currentPage.value = Math.max(1, totalPages.value)
    }
  })

  watch(currentPage, () => {
    if (opts?.onPageChange) opts.onPageChange()
  })

  function prevPage() { if (hasPrev.value) currentPage.value-- }
  function nextPage() { if (hasNext.value) currentPage.value++ }
  function goToPage(p: number) { currentPage.value = Math.max(1, Math.min(p, totalPages.value)) }
  function reset() { currentPage.value = 1 }
  function setLoading(v: boolean) { loading.value = v }

  return {
    currentPage, totalPages, totalItems,
    hasPrev, hasNext, pagedItems,
    prevPage, nextPage, goToPage, reset,
    pageInfoText, visiblePages, loading, setLoading,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  }
}
