<template>
  <div class="notes-view">
    <!-- Toolbar -->
    <v-toolbar density="compact" color="surface" class="border-b">
      <v-toolbar-title>笔记</v-toolbar-title>

      <v-spacer />

      <v-text-field
        v-model="searchQuery"
        prepend-inner-icon="mdi-magnify"
        placeholder="搜索笔记..."
        hide-details
        variant="plain"
        density="compact"
        class="search-field"
        clearable
      />

      <v-select
        v-model="filterBookId"
        :items="bookOptions"
        item-title="title"
        item-value="value"
        density="compact"
        variant="plain"
        hide-details
        clearable
        placeholder="按书筛选"
        class="book-select"
      />

      <v-tooltip v-if="trashTabCount > 0" text="清空回收站" location="bottom">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            color="error"
            size="small"
            variant="tonal"
            prepend-icon="mdi-delete-empty"
            class="ml-2"
            @click="showClearTrashConfirm = true"
          >
            清空
          </v-btn>
        </template>
      </v-tooltip>
      <v-btn
        variant="outlined"
        color="warning"
        size="small"
        :loading="cleaningOrphans"
        class="ml-2"
        @click="cleanupOrphans"
      >
        <v-icon start size="18">mdi-delete-restore</v-icon>
        清理失效数据
      </v-btn>
    </v-toolbar>

    <!-- Tabs -->
    <v-tabs v-model="activeTab" density="compact" color="primary" class="border-b">
      <v-tab value="active" prepend-icon="mdi-note-text">
        笔记
        <v-chip size="x-small" class="ml-1" variant="flat" color="primary">
          {{ activeAnnotations.length }}
        </v-chip>
      </v-tab>
      <v-tab value="trash" prepend-icon="mdi-delete">
        回收站
        <v-chip size="x-small" class="ml-1" variant="flat" color="grey">
          {{ trashTabCount }}
        </v-chip>
      </v-tab>
    </v-tabs>

    <!-- Content -->
    <div class="notes-content pa-4">
      <!-- ======================= Active Annotations ======================= -->
      <template v-if="activeTab === 'active'">
        <v-list v-if="pagedActiveAnnotations.length > 0" density="compact" class="annotation-list">
          <v-list-item
            v-for="ann in pagedActiveAnnotations"
            :key="ann.id"
            @click="goToAnnotation(ann)"
            class="annotation-item"
          >
            <!-- Checkbox -->
            <template #prepend>
              <v-checkbox
                :model-value="selectedIds.has(ann.id)"
                density="compact"
                hide-details
                class="select-checkbox mr-1"
                @click.stop
                @update:model-value="toggleSelect(ann.id)"
              />
              <v-tooltip :text="getColorLabel(ann.color)" location="top">
                <template #activator="{ props }">
                  <div
                    v-bind="props"
                    class="annotation-dot"
                    :style="{ backgroundColor: getColorHex(ann.color) }"
                  />
                </template>
              </v-tooltip>
            </template>

            <!-- Main content -->
            <v-list-item-title class="text-body-2 font-weight-medium annotation-text">
              {{ ann.text }}
            </v-list-item-title>

            <!-- Meta row -->
            <v-list-item-subtitle class="mt-1">
              <div class="d-flex align-center flex-wrap ga-1">
                <v-chip size="x-small" variant="flat" color="primary">
                  {{ getBookTitle(ann.bookId) }}
                </v-chip>
                <v-chip v-if="ann.bookDeleted" size="x-small" color="warning" variant="tonal">原文件已删除</v-chip>
                <v-chip size="x-small" variant="text" class="text-medium-emphasis">
                  {{ getChapterTitle(ann) }}
                </v-chip>
                <span class="text-caption text-medium-emphasis">{{ formatDate(ann.createdAt) }}</span>
              </div>
            </v-list-item-subtitle>

            <!-- Note section -->
            <div v-if="editingId !== ann.id" class="mt-2">
              <div
                v-if="ann.note"
                class="annotation-note-read text-body-2 text-medium-emphasis"
                @click.stop="startEdit(ann)"
              >
                <v-icon size="14" class="mr-1">mdi-note-text</v-icon>
                {{ ann.note }}
              </div>
              <div
                v-else
                class="annotation-note-empty text-caption text-disabled"
                @click.stop="startEdit(ann)"
              >
                <v-icon size="14" class="mr-1">mdi-note-plus</v-icon>
                添加笔记...
              </div>
            </div>

            <!-- Inline edit -->
            <div v-else class="mt-2" @click.stop>
              <v-textarea
                v-model="editingContent"
                density="compact"
                variant="outlined"
                rows="3"
                hide-details
                autofocus
                class="edit-textarea"
                @keyup.escape="cancelEdit"
              />
              <div class="d-flex justify-end ga-1 mt-1">
                <v-btn
                  size="x-small"
                  variant="tonal"
                  @click="cancelEdit"
                >
                  取消
                </v-btn>
                <v-btn
                  size="x-small"
                  variant="tonal"
                  color="primary"
                  @click="saveEdit(ann)"
                >
                  保存
                </v-btn>
              </div>
            </div>

            <!-- Actions -->
            <template #append>
              <div class="d-flex flex-column align-end">
                <div class="d-flex">
                  <v-tooltip text="编辑笔记" location="top">
                    <template #activator="{ props }">
                      <v-btn
                        v-bind="props"
                        icon="mdi-pencil"
                        size="x-small"
                        variant="tonal"
                        @click.stop="startEdit(ann)"
                      />
                    </template>
                  </v-tooltip>
                  <v-tooltip text="删除" location="top">
                    <template #activator="{ props }">
                      <v-btn
                        v-bind="props"
                        icon="mdi-delete"
                        size="x-small"
                        variant="tonal"
                        color="error"
                        @click.stop="softDeleteAnnotation(ann)"
                      />
                    </template>
                  </v-tooltip>
                </div>
              </div>
            </template>
          </v-list-item>
        </v-list>

        <!-- Pagination -->
        <div v-if="activeTotalPages > 1" class="pagination-bar">
          <v-btn size="x-small" icon="mdi-chevron-left" :disabled="!activeHasPrev" @click="activePrevPage" />
          <span class="text-caption mx-2">第 {{ activeCurrentPage }} / {{ activeTotalPages }} 页</span>
          <v-btn size="x-small" icon="mdi-chevron-right" :disabled="!activeHasNext" @click="activeNextPage" />
        </div>

        <!-- Empty state -->
        <div v-if="filteredAnnotations.length === 0" class="empty-state">
          <v-icon size="64" class="mb-2" color="medium-emphasis">mdi-note-text-outline</v-icon>
          <p class="text-medium-emphasis">
            {{ allAnnotations.length === 0 ? '暂无笔记' : '没有匹配的笔记' }}
          </p>
          <p class="text-caption text-medium-emphasis">阅读时选中文字可以添加笔记</p>
        </div>
      </template>

      <!-- ======================= Trash ======================= -->
      <template v-if="activeTab === 'trash'">
        <v-list v-if="pagedTrashAnnotations.length > 0" density="compact">
          <v-list-item
            v-for="ann in pagedTrashAnnotations"
            :key="ann.id"
          >
            <template #prepend>
              <v-checkbox
                :model-value="selectedIds.has(ann.id)"
                density="compact"
                hide-details
                class="select-checkbox mr-1"
                @click.stop
                @update:model-value="toggleSelect(ann.id)"
              />
              <div
                class="annotation-dot annotation-dot--deleted"
                :style="{ backgroundColor: getColorHex(ann.color) }"
              />
            </template>

            <v-list-item-title class="text-body-2 text-disabled">
              {{ ann.text }}
            </v-list-item-title>

            <v-list-item-subtitle class="mt-1">
              <div class="d-flex align-center flex-wrap ga-1">
                <v-chip size="x-small" variant="flat" class="text-disabled">
                  {{ getBookTitle(ann.bookId) }}
                </v-chip>
                <span class="text-caption text-medium-emphasis">{{ formatDate(ann.createdAt) }}</span>
              </div>
            </v-list-item-subtitle>

            <template #append>
              <div class="d-flex">
                <v-tooltip text="恢复" location="top">
                  <template #activator="{ props }">
                    <v-btn
                      v-bind="props"
                      icon="mdi-restore"
                      size="x-small"
                      variant="tonal"
                      color="primary"
                      @click.stop="restoreAnnotation(ann)"
                    />
                  </template>
                </v-tooltip>
                <v-tooltip text="永久删除" location="top">
                  <template #activator="{ props }">
                    <v-btn
                      v-bind="props"
                      icon="mdi-delete-forever"
                      size="x-small"
                      variant="tonal"
                      color="error"
                      @click.stop="permanentlyDeleteAnnotation(ann)"
                    />
                  </template>
                </v-tooltip>
              </div>
            </template>
          </v-list-item>
        </v-list>

        <!-- Pagination -->
        <div v-if="trashTotalPages > 1" class="pagination-bar">
          <v-btn size="x-small" icon="mdi-chevron-left" :disabled="!trashHasPrev" @click="trashPrevPage" />
          <span class="text-caption mx-2">第 {{ trashCurrentPage }} / {{ trashTotalPages }} 页</span>
          <v-btn size="x-small" icon="mdi-chevron-right" :disabled="!trashHasNext" @click="trashNextPage" />
        </div>

        <!-- Empty trash -->
        <div v-if="deletedAnnotations.length === 0" class="empty-state">
          <v-icon size="64" class="mb-2" color="medium-emphasis">mdi-delete-outline</v-icon>
          <p class="text-medium-emphasis">回收站为空</p>
        </div>
      </template>
    </div>

    <!-- Floating batch bar -->
    <div v-if="selectedCount > 0" class="batch-bar">
      <span class="text-body-2 font-weight-medium">已选 {{ selectedCount }} 条</span>
      <v-spacer />
      <v-btn variant="tonal" size="small" @click="selectAll">全选</v-btn>
      <v-btn variant="tonal" size="small" class="ml-1" @click="invertSelection">反选</v-btn>
      <template v-if="activeTab === 'active'">
        <v-btn variant="tonal" size="small" color="error" class="ml-1" prepend-icon="mdi-delete" @click="batchDelete">删除</v-btn>
      </template>
      <template v-else>
        <v-btn variant="tonal" size="small" color="primary" class="ml-1" prepend-icon="mdi-restore" @click="batchRestore">恢复</v-btn>
        <v-btn variant="tonal" size="small" color="error" class="ml-1" prepend-icon="mdi-delete-forever" @click="batchPermanentDelete">删除</v-btn>
      </template>
    </div>

    <!-- Clear trash confirm dialog -->
    <v-dialog v-model="showClearTrashConfirm" max-width="420">
      <v-card>
        <v-card-title class="d-flex align-center text-error">
          <v-icon color="error" class="mr-2">mdi-alert</v-icon>
          确认清空回收站
        </v-card-title>
        <v-card-text>
          <p>确定要永久删除回收站中的所有笔记吗？</p>
          <p class="text-caption text-error">此操作不可撤销！</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="tonal" @click="showClearTrashConfirm = false">取消</v-btn>
          <v-btn variant="tonal" color="error" @click="clearTrash">确认清空</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-snackbar v-model="showSnackbar" :timeout="3000">
      {{ snackbarText }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/services/db'
import { useBookshelfStore } from '@/stores/bookshelf'
import { usePagination, getPageSize } from '@/composables/usePagination'
import { HIGHLIGHT_COLORS } from '@/constants'
import type { Annotation, HighlightColor } from '@/types'
import dayjs from 'dayjs'

// ---- API helpers: prefer electronAPI, fall back to Dexie ----
const api = {
  ann: {
    toArray: () => window.electronAPI?.annotations?.getAll?.() ?? db.ann.toArray(),
    put: (data: any) => window.electronAPI?.annotations?.insert?.(data.id, JSON.stringify(data)) ?? db.ann.put(data),
    delete: (id: string) => window.electronAPI?.annotations?.delete?.(id) ?? db.ann.delete(id),
  },
}

const router = useRouter()
const bookshelf = useBookshelfStore()

// ---- State ----
const allAnnotations = ref<Annotation[]>([])
const searchQuery = ref('')
const filterBookId = ref('')
const activeTab = ref('active')
const editingId = ref('')
const editingContent = ref('')
const showClearTrashConfirm = ref(false)
const cleaningOrphans = ref(false)
const snackbarText = ref('')
const showSnackbar = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const notesPageSize = ref(20)

const selectedCount = computed(() => selectedIds.value.size)

// ---- Computed ----

const bookOptions = computed(() =>
  bookshelf.books.map(b => ({ title: b.title, value: b.id }))
)

const activeAnnotations = computed(() =>
  allAnnotations.value.filter(a => !a.deleted)
)

const deletedAnnotations = computed(() =>
  allAnnotations.value.filter(a => a.deleted)
)

const trashTabCount = computed(() => deletedAnnotations.value.length)

const filteredAnnotations = computed(() => {
  const bookMap = new Map(bookshelf.books.map(b => [b.id, b]))
  let result = activeAnnotations.value.slice()

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(a =>
      a.text.toLowerCase().includes(q) ||
      (a.note || '').toLowerCase().includes(q)
    )
  }

  if (filterBookId.value) {
    result = result.filter(a => a.bookId === filterBookId.value)
  }

  result.sort((a, b) => b.createdAt - a.createdAt)
  return result.map(n => ({
    ...n,
    bookDeleted: !bookMap.has(n.bookId)
  }))
})

// ---- Pagination (active) ----
const scrollNotesToTop = () => { nextTick(() => {
  const el = document.querySelector('.notes-content')
  if (el) el.scrollTop = 0
})}

const {
  currentPage: activeCurrentPage,
  totalPages: activeTotalPages,
  hasPrev: activeHasPrev,
  hasNext: activeHasNext,
  pagedItems: pagedActiveAnnotations,
  prevPage: activePrevPage,
  nextPage: activeNextPage
} = usePagination(filteredAnnotations, notesPageSize, { onPageChange: scrollNotesToTop })

// ---- Pagination (trash) ----
const {
  currentPage: trashCurrentPage,
  totalPages: trashTotalPages,
  hasPrev: trashHasPrev,
  hasNext: trashHasNext,
  pagedItems: pagedTrashAnnotations,
  prevPage: trashPrevPage,
  nextPage: trashNextPage
} = usePagination(deletedAnnotations, notesPageSize, { onPageChange: scrollNotesToTop })

// ---- Helpers ----

function getColorHex(color: HighlightColor): string {
  return HIGHLIGHT_COLORS.find(c => c.value === color)?.hex || '#F9A825'
}

function getColorLabel(color: HighlightColor): string {
  return HIGHLIGHT_COLORS.find(c => c.value === color)?.label || '黄色'
}

const BOOK_TITLE_CACHE_KEY = 'notes_book_titles'
let bookTitleCache = loadTitleCache()

function loadTitleCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(BOOK_TITLE_CACHE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveTitleCache() {
  try { localStorage.setItem(BOOK_TITLE_CACHE_KEY, JSON.stringify(bookTitleCache)) } catch {}
}

// Sync from bookshelf store
watch(() => bookshelf.books.length, () => {
  for (const b of bookshelf.books) {
    if (b.title) bookTitleCache[b.id] = b.title
  }
  saveTitleCache()
}, { immediate: true })

function getBookTitle(bookId: string): string {
  const b = bookshelf.books.find(b => b.id === bookId)
  if (b?.title) {
    bookTitleCache[bookId] = b.title
    return b.title
  }
  return bookTitleCache[bookId] || '已删除'
}

const bookExists = (bookId: string) => bookshelf.books.some(b => b.id === bookId)

function getChapterTitle(ann: Annotation): string {
  return `第 ${ann.chapterIndex + 1} 章`
}

function formatDate(ts: number): string {
  return dayjs(ts).format('YYYY-MM-DD HH:mm')
}

// ---- Load ----

async function loadAnnotations() {
  const records = await api.ann.toArray()
  allAnnotations.value = records
    .map((r: any) => {
      try { return (typeof r.data === 'string' ? JSON.parse(r.data) : r) as Annotation }
      catch { return null }
    })
    .filter((a: any): a is Annotation => a !== null)
}

// ---- Navigation ----

function goToAnnotation(ann: Annotation) {
  router.push({
    name: 'reader',
    params: { id: ann.bookId },
    query: { ci: String(ann.chapterIndex), aid: ann.id }
  })
}

// ---- Inline edit ----

function startEdit(ann: Annotation) {
  editingId.value = ann.id
  editingContent.value = ann.note
}

function cancelEdit() {
  editingId.value = ''
  editingContent.value = ''
}

async function saveEdit(ann: Annotation) {
  const oldNote = ann.note
  ann.note = editingContent.value
  ann.deleted = ann.deleted || false
  try {
    await api.ann.put({ id: ann.id, data: JSON.stringify(ann) })
    const idx = allAnnotations.value.findIndex(a => a.id === ann.id)
    if (idx >= 0) allAnnotations.value[idx] = { ...ann }
    editingId.value = ''
    editingContent.value = ''
  } catch {
    ann.note = oldNote
  }
}

// ---- Soft delete / Trash ----

async function softDeleteAnnotation(ann: Annotation) {
  const wasDeleted = ann.deleted
  ann.deleted = true
  try {
    await api.ann.put({ id: ann.id, data: JSON.stringify(ann) })
    const idx = allAnnotations.value.findIndex(a => a.id === ann.id)
    if (idx >= 0) allAnnotations.value[idx] = { ...ann }
  } catch {
    ann.deleted = wasDeleted
  }
}

async function restoreAnnotation(ann: Annotation) {
  const wasDeleted = ann.deleted
  ann.deleted = false
  try {
    await api.ann.put({ id: ann.id, data: JSON.stringify(ann) })
    const idx = allAnnotations.value.findIndex(a => a.id === ann.id)
    if (idx >= 0) allAnnotations.value[idx] = { ...ann }
  } catch {
    ann.deleted = wasDeleted
  }
}

async function permanentlyDeleteAnnotation(ann: Annotation) {
  try {
    await api.ann.delete(ann.id)
    allAnnotations.value = allAnnotations.value.filter(a => a.id !== ann.id)
  } catch { /* keep in UI if delete failed */ }
}

async function clearTrash() {
  const ids = deletedAnnotations.value.map(a => a.id)
  if (ids.length === 0) return
  const results = await Promise.allSettled(ids.map(id => api.ann.delete(id)))
  const failedIds = new Set(ids.filter((_, i) => results[i].status === 'rejected'))
  allAnnotations.value = allAnnotations.value.filter(a => !a.deleted || failedIds.has(a.id))
  showClearTrashConfirm.value = false
}

// ---- Multi-select ----

function toggleSelect(id: string) {
  const s = selectedIds.value
  if (s.has(id)) {
    s.delete(id)
  } else {
    s.add(id)
  }
  selectedIds.value = new Set(s)
}

function selectAll() {
  const visible = activeTab.value === 'active'
    ? filteredAnnotations.value
    : deletedAnnotations.value
  selectedIds.value = new Set(visible.map(a => a.id))
}

function clearSelection() {
  selectedIds.value = new Set()
}

function invertSelection() {
  const visible = activeTab.value === 'active'
    ? filteredAnnotations.value
    : deletedAnnotations.value
  const current = selectedIds.value
  const inverted = new Set<string>()
  for (const a of visible) {
    if (!current.has(a.id)) inverted.add(a.id)
  }
  selectedIds.value = inverted
}

const batchProgress = ref(0)
const batchTotal = ref(0)
const isBatchOp = ref(false)

async function batchDelete() {
  const ids = [...selectedIds.value]
  batchTotal.value = ids.length
  batchProgress.value = 0
  isBatchOp.value = true
  let errors = 0
  for (const id of ids) {
    const ann = allAnnotations.value.find(a => a.id === id)
    if (ann) {
      try {
        ann.deleted = true
        await api.ann.put({ id: ann.id, data: JSON.stringify(ann) })
        const idx = allAnnotations.value.findIndex(a => a.id === ann.id)
        if (idx >= 0) allAnnotations.value[idx] = { ...ann }
      } catch { errors++ }
    }
    batchProgress.value++
  }
  clearSelection()
  isBatchOp.value = false
  snackbarText.value = errors > 0 ? `已删除 ${batchProgress.value - errors} 条，${errors} 条失败` : `已删除 ${batchProgress.value} 条`
  showSnackbar.value = true
}

async function batchRestore() {
  const ids = [...selectedIds.value]
  batchTotal.value = ids.length
  batchProgress.value = 0
  isBatchOp.value = true
  let errors = 0
  for (const id of ids) {
    const ann = allAnnotations.value.find(a => a.id === id)
    if (ann) {
      try {
        ann.deleted = false
        await api.ann.put({ id: ann.id, data: JSON.stringify(ann) })
        const idx = allAnnotations.value.findIndex(a => a.id === ann.id)
        if (idx >= 0) allAnnotations.value[idx] = { ...ann }
      } catch { errors++ }
    }
    batchProgress.value++
  }
  clearSelection()
  isBatchOp.value = false
  snackbarText.value = errors > 0 ? `已恢复 ${batchProgress.value - errors} 条，${errors} 条失败` : `已恢复 ${batchProgress.value} 条`
  showSnackbar.value = true
}

async function batchPermanentDelete() {
  const ids = [...selectedIds.value]
  await Promise.all(ids.map(id => api.ann.delete(id)))
  allAnnotations.value = allAnnotations.value.filter(a => !ids.includes(a.id))
  clearSelection()
}

// ---- Lifecycle ----

async function cleanupOrphans() {
  cleaningOrphans.value = true
  try {
    const result = await window.electronAPI.cleanupOrphans()
    snackbarText.value = `清理完成: ${result.annotations || 0} 条标注, ${result.bookmarks || 0} 条书签, ${result.history || 0} 条历史`
    showSnackbar.value = true
  } catch (e: any) {
    snackbarText.value = '清理失败: ' + (e.message || '未知错误')
    showSnackbar.value = true
  } finally {
    cleaningOrphans.value = false
  }
}

onMounted(async () => {
  if (bookshelf.books.length === 0) await bookshelf.loadBooks()
  await loadAnnotations()
  notesPageSize.value = await getPageSize('notes')
})
</script>

<style scoped>
.notes-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.notes-content {
  flex: 1;
  overflow-y: auto;
}

.search-field {
  max-width: 240px;
}

.book-select {
  max-width: 180px;
}

/* ---- Pagination ---- */

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 0;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}

/* ---- Annotation list ---- */

.annotation-list {
  background: transparent;
}

.annotation-item {
  cursor: pointer;
  border-radius: 8px;
  margin-bottom: 4px;
  transition: background 0.15s;
}

.annotation-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.annotation-text {
  white-space: normal;
}

/* ---- Color dot ---- */

.annotation-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 1.5px solid rgba(0, 0, 0, 0.15);
}

.annotation-dot--deleted {
  opacity: 0.45;
}

/* ---- Note ---- */

.annotation-note-read {
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border-left: 3px solid rgba(var(--v-theme-primary), 0.4);
  cursor: pointer;
  transition: background 0.15s;
}

.annotation-note-read:hover {
  background: rgba(var(--v-theme-on-surface), 0.07);
}

.annotation-note-empty {
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px dashed rgba(var(--v-theme-on-surface), 0.15);
  cursor: pointer;
  transition: background 0.15s;
}

.annotation-note-empty:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.edit-textarea {
  max-width: 100%;
}

/* ---- Empty state ---- */

.empty-state {
  text-align: center;
  padding: 64px 16px;
}

/* ---- Batch bar ---- */

.batch-bar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  background: rgb(var(--v-theme-surface));
  position: sticky;
  bottom: 0;
  z-index: 10;
}

/* ---- Select checkbox ---- */

.select-checkbox {
  flex-shrink: 0;
}
</style>
