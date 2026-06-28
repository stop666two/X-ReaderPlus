<template>
  <div class="trash-view">
    <v-toolbar density="compact" color="surface" class="border-b">
      <v-toolbar-title>回收站</v-toolbar-title>
      <v-spacer />
      <v-btn
        v-if="pagedTrashItems.length > 0 && !clearingInProgress"
        color="warning"
        size="small"
        variant="text"
        prepend-icon="mdi-delete-sweep"
        class="mr-1"
        @click="showClearPageConfirm = true"
      >
        删除当页
      </v-btn>
      <v-btn
        v-if="trashItems.length > 0 && !clearingInProgress"
        color="error"
        size="small"
        variant="text"
        prepend-icon="mdi-delete-empty"
        @click="showClearConfirm = true"
      >
        清空回收站
      </v-btn>
    </v-toolbar>

    <v-progress-linear
      v-if="clearingInProgress"
      :model-value="clearProgressPercent"
      color="error"
      height="4"
    />
    <div
      v-if="clearingInProgress"
      class="clear-progress-text px-4 py-1 text-caption text-error"
    >
      正在清空... ({{ clearProgress.current }}/{{ clearProgress.total }})
    </div>

    <div class="trash-content pa-4">
      <div v-if="trashItems.length === 0" class="text-center py-8">
        <v-icon size="64" class="mb-2" color="medium-emphasis">mdi-delete-outline</v-icon>
        <p class="text-medium-emphasis">回收站为空</p>
        <p class="text-caption text-medium-emphasis">删除的书籍会出现在这里</p>
      </div>

      <v-list v-else density="compact" select-strategy="classic">
        <v-list-item
          v-for="item in pagedTrashItems"
          :key="item.id"
          :title="item.book.title"
          :subtitle="`删除于 ${formatDate(item.deletedAt)} · ${item.book.format.toUpperCase()} · ${formatSize(item.book.size)}`"
          :active="selectedTrashIds.has(item.id)"
          @click="toggleTrashSelect(item.id)"
        >
          <template #prepend>
            <v-checkbox
              :model-value="selectedTrashIds.has(item.id)"
              density="compact"
              hide-details
              @click.stop
              @update:model-value="toggleTrashSelect(item.id)"
            />
            <v-icon>mdi-book</v-icon>
          </template>
          <template #append>
            <v-btn
              color="primary"
              size="small"
              variant="text"
              prepend-icon="mdi-restore"
              @click.stop="restoreItem(item.id)"
            >
              恢复
            </v-btn>
            <v-btn
              color="error"
              size="small"
              variant="text"
              icon="mdi-delete-forever"
              @click.stop="confirmSingleDelete(item.id)"
            />
          </template>
        </v-list-item>
      </v-list>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination-bar">
        <v-btn size="x-small" icon="mdi-chevron-left" :disabled="!hasPrev" @click="prevPage" />
        <span class="text-caption mx-2">第 {{ currentPage }} / {{ totalPages }} 页</span>
        <v-btn size="x-small" icon="mdi-chevron-right" :disabled="!hasNext" @click="nextPage" />
      </div>
    </div>

    <!-- Floating batch bar -->
    <div v-if="selectedTrashIds.size > 0" class="batch-bar px-4 py-2">
      <span class="text-body-2 mr-3">已选{{ selectedTrashIds.size }}项</span>
      <v-btn size="small" variant="text" @click="selectAllTrash">全选</v-btn>
      <v-btn size="small" variant="text" @click="invertTrashSelection">反选</v-btn>
      <v-spacer />
      <v-btn
        size="small"
        variant="text"
        color="primary"
        prepend-icon="mdi-restore"
        @click="batchRestore"
      >
        恢复
      </v-btn>
      <v-btn
        size="small"
        variant="text"
        color="error"
        prepend-icon="mdi-delete-forever"
        @click="showBatchDeleteConfirm = true"
      >
        永久删除
      </v-btn>
    </div>

    <!-- Clear page confirm dialog -->
    <v-dialog v-model="showClearPageConfirm" max-width="400">
      <v-card>
        <v-card-title class="text-warning">
          <v-icon color="warning" class="mr-2">mdi-alert</v-icon>
          确认删除当页
        </v-card-title>
        <v-card-text>
          <p>确定要永久删除当前页的 {{ pagedTrashItems.length }} 本回收站书籍吗？</p>
          <p class="text-caption text-error">此操作不可撤销！</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showClearPageConfirm = false">取消</v-btn>
          <v-btn color="error" @click="clearCurrentPage">确认删除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Clear confirm dialog -->
    <v-dialog v-model="showClearConfirm" max-width="400">
      <v-card>
        <v-card-title class="text-error">
          <v-icon color="error" class="mr-2">mdi-alert</v-icon>
          确认清空回收站
        </v-card-title>
        <v-card-text>
          <p>确定要永久删除回收站中的所有书籍吗？</p>
          <p class="text-caption text-error">此操作不可撤销！</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showClearConfirm = false">取消</v-btn>
          <v-btn color="error" @click="clearTrash">确认清空</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Batch delete confirm dialog -->
    <v-dialog v-model="showBatchDeleteConfirm" max-width="400">
      <v-card>
        <v-card-title class="text-error">
          <v-icon color="error" class="mr-2">mdi-alert</v-icon>
          确认批量永久删除
        </v-card-title>
        <v-card-text>
          <p>确定要永久删除选中的 {{ selectedTrashIds.size }} 本书籍吗？</p>
          <p class="text-caption text-error">此操作不可撤销！</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showBatchDeleteConfirm = false">取消</v-btn>
          <v-btn color="error" @click="batchPermanentDelete">确认删除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Single delete confirm dialog -->
    <v-dialog v-model="showSingleDeleteConfirm" max-width="400">
      <v-card>
        <v-card-title class="text-error">
          <v-icon color="error" class="mr-2">mdi-alert</v-icon>
          确认永久删除
        </v-card-title>
        <v-card-text>
          <p>确定要永久删除「{{ singleDeleteTarget?.book.title }}」吗？</p>
          <p class="text-caption text-error">此操作不可撤销！</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showSingleDeleteConfirm = false">取消</v-btn>
          <v-btn color="error" @click="executeSingleDelete">确认删除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import type { TrashItem } from '@/types'
import { useBookshelfStore } from '@/stores/bookshelf'
import { batchProcess } from '@/stores/bookshelf'
import { usePagination, getPageSize } from '@/composables/usePagination'
import dayjs from 'dayjs'

const bookshelf = useBookshelfStore()
const trashItems = ref<TrashItem[]>([])
const showClearConfirm = ref(false)
const showClearPageConfirm = ref(false)
const showBatchDeleteConfirm = ref(false)
const showSingleDeleteConfirm = ref(false)
const singleDeleteTarget = ref<TrashItem | null>(null)
const clearingInProgress = ref(false)
const clearProgress = ref({ current: 0, total: 0 })
const selectedTrashIds = ref<Set<string>>(new Set())
const trashPageSize = ref(20)

const clearProgressPercent = computed(() => {
  if (clearProgress.value.total === 0) return 0
  return (clearProgress.value.current / clearProgress.value.total) * 100
})

// ---- Pagination ----
const {
  currentPage,
  totalPages,
  hasPrev,
  hasNext,
  pagedItems: pagedTrashItems,
  prevPage,
  nextPage
} = usePagination(trashItems, trashPageSize, {
  onPageChange: () => { nextTick(() => {
    const el = document.querySelector('.trash-content')
    if (el) el.scrollTop = 0
  })}
})

// ---- Selection ----

function toggleTrashSelect(id: string) {
  const s = new Set(selectedTrashIds.value)
  if (s.has(id)) { s.delete(id) } else { s.add(id) }
  selectedTrashIds.value = s
}

function selectAllTrash() {
  selectedTrashIds.value = new Set(pagedTrashItems.value.map(t => t.id))
}

function invertTrashSelection() {
  const allIds = new Set(trashItems.value.map(t => t.id))
  const inverted = new Set<string>()
  allIds.forEach(id => {
    if (!selectedTrashIds.value.has(id)) inverted.add(id)
  })
  selectedTrashIds.value = inverted
}

function clearTrashSelection() {
  selectedTrashIds.value = new Set()
}

// ---- API helper (guards against missing electronAPI in browser dev mode) ----
function getApi() {
  if (!window.electronAPI) throw new Error('electronAPI 不可用，回收站操作需要在 Electron 环境下进行')
  return window.electronAPI
}

// ---- Load ----

async function loadTrash() {
  try { trashItems.value = (await getApi().trash.getAll()).map((r: any) => (typeof r.data === 'string' ? JSON.parse(r.data) : r)) }
  catch { trashItems.value = [] }
}

// ---- Restore ----

async function restoreItem(id: string) {
  const api = getApi()
  const record = await api.trash.get(id)
  if (record) {
    const item: TrashItem = typeof record.data === 'string' ? JSON.parse(record.data) : record
    const book = item.book
    await api.books.insert({...book})
    await api.trash.delete(id)
    selectedTrashIds.value.delete(id)
    selectedTrashIds.value = new Set(selectedTrashIds.value)
    await loadTrash()
    await bookshelf.loadBooks()
  }
}

async function batchRestore() {
  const api = getApi()
  const ids = [...selectedTrashIds.value]
  await batchProcess(
    ids,
    50,
    async (id) => {
      const record = await api.trash.get(id)
      if (record) {
        const item: TrashItem = typeof record.data === 'string' ? JSON.parse(record.data) : record
        const book = item.book
        await api.books.insert({...book})
        await api.trash.delete(id)
      }
    }
  )
  clearTrashSelection()
  await loadTrash()
  await bookshelf.loadBooks()
}

// ---- Delete ----

async function permanentlyDelete(id: string) {
  await getApi().trash.permanentDelete(id)
}

function confirmSingleDelete(id: string) {
  const item = trashItems.value.find(t => t.id === id)
  if (item) {
    singleDeleteTarget.value = item
    showSingleDeleteConfirm.value = true
  }
}

async function executeSingleDelete() {
  if (singleDeleteTarget.value) {
    await permanentlyDelete(singleDeleteTarget.value.id)
    selectedTrashIds.value.delete(singleDeleteTarget.value.id)
    selectedTrashIds.value = new Set(selectedTrashIds.value)
    singleDeleteTarget.value = null
  }
  showSingleDeleteConfirm.value = false
  await loadTrash()
}

async function batchPermanentDelete() {
  showBatchDeleteConfirm.value = false
  const ids = [...selectedTrashIds.value]
  clearingInProgress.value = true
  clearProgress.value = { current: 0, total: ids.length }

  await batchProcess(
    ids,
    50,
    async (id) => {
      await getApi().trash.permanentDelete(id)
      clearProgress.value = { current: clearProgress.value.current + 1, total: ids.length }
    }
  )

  clearingInProgress.value = false
  clearProgress.value = { current: 0, total: 0 }
  clearTrashSelection()
  await loadTrash()
}

async function clearCurrentPage() {
  showClearPageConfirm.value = false
  clearingInProgress.value = true
  const ids = pagedTrashItems.value.map(t => t.id)
  clearProgress.value = { current: 0, total: ids.length }

  await batchProcess(
    ids,
    50,
    async (id) => {
      await getApi().trash.permanentDelete(id)
      clearProgress.value = { current: clearProgress.value.current + 1, total: ids.length }
    }
  )

  clearingInProgress.value = false
  clearProgress.value = { current: 0, total: 0 }
  await loadTrash()
}

async function clearTrash() {
  showClearConfirm.value = false
  clearingInProgress.value = true
  const total = trashItems.value.length
  clearProgress.value = { current: 0, total }

  await getApi().trash.clear()
  clearProgress.value = { current: total, total }

  clearingInProgress.value = false
  clearProgress.value = { current: 0, total: 0 }
  await loadTrash()
}

// ---- Helpers ----

function formatDate(ts: number): string {
  return dayjs(ts).format('YYYY-MM-DD HH:mm')
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

onMounted(async () => {
  await loadTrash()
  trashPageSize.value = await getPageSize('trash')
})
</script>

<style scoped>
.trash-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.trash-content {
  flex: 1;
  overflow-y: auto;
}

/* ---- Pagination ---- */

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 0;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.06);
  margin-top: 8px;
}

.batch-bar {
  display: flex;
  align-items: center;
  background: rgb(var(--v-theme-surface));
  border-top: 1px solid rgba(var(--v-border-color), 0.12);
  gap: 4px;
}

.clear-progress-text {
  background: rgba(var(--v-theme-error), 0.08);
}
</style>
