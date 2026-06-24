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
        <v-list v-if="filteredAnnotations.length > 0" density="compact" class="annotation-list">
          <v-list-item
            v-for="ann in filteredAnnotations"
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

        <!-- Empty state -->
        <div v-else class="empty-state">
          <v-icon size="64" class="mb-2" color="medium-emphasis">mdi-note-text-outline</v-icon>
          <p class="text-medium-emphasis">
            {{ allAnnotations.length === 0 ? '暂无笔记' : '没有匹配的笔记' }}
          </p>
          <p class="text-caption text-medium-emphasis">阅读时选中文字可以添加笔记</p>
        </div>
      </template>

      <!-- ======================= Trash ======================= -->
      <template v-if="activeTab === 'trash'">
        <v-list v-if="deletedAnnotations.length > 0" density="compact">
          <v-list-item
            v-for="ann in deletedAnnotations"
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

        <!-- Empty trash -->
        <div v-else class="empty-state">
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/services/db'
import { useBookshelfStore } from '@/stores/bookshelf'
import { HIGHLIGHT_COLORS } from '@/constants'
import type { Annotation, HighlightColor } from '@/types'
import dayjs from 'dayjs'

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
const selectedIds = ref<Set<string>>(new Set())

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
  let result = activeAnnotations.value.slice()

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(a =>
      a.text.toLowerCase().includes(q) ||
      a.note.toLowerCase().includes(q)
    )
  }

  if (filterBookId.value) {
    result = result.filter(a => a.bookId === filterBookId.value)
  }

  result.sort((a, b) => b.createdAt - a.createdAt)
  return result
})

// ---- Helpers ----

function getColorHex(color: HighlightColor): string {
  return HIGHLIGHT_COLORS.find(c => c.value === color)?.hex || '#F9A825'
}

function getColorLabel(color: HighlightColor): string {
  return HIGHLIGHT_COLORS.find(c => c.value === color)?.label || '黄色'
}

function getBookTitle(bookId: string): string {
  return bookshelf.books.find(b => b.id === bookId)?.title || '未知书籍'
}

function getChapterTitle(ann: Annotation): string {
  // Try to load chapter from db (cached in memory if the book was opened)
  // Fallback to chapter index
  return `第 ${ann.chapterIndex + 1} 章`
}

function formatDate(ts: number): string {
  return dayjs(ts).format('YYYY-MM-DD HH:mm')
}

// ---- Load ----

async function loadAnnotations() {
  const records = await db.ann.toArray()
  allAnnotations.value = records
    .map(r => {
      try { return JSON.parse(r.data) as Annotation }
      catch { return null }
    })
    .filter((a): a is Annotation => a !== null)
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
  ann.note = editingContent.value
  ann.deleted = ann.deleted || false
  await db.ann.put({ id: ann.id, data: JSON.stringify(ann) })
  const idx = allAnnotations.value.findIndex(a => a.id === ann.id)
  if (idx >= 0) allAnnotations.value[idx] = { ...ann }
  editingId.value = ''
  editingContent.value = ''
}

// ---- Soft delete / Trash ----

async function softDeleteAnnotation(ann: Annotation) {
  ann.deleted = true
  await db.ann.put({ id: ann.id, data: JSON.stringify(ann) })
  const idx = allAnnotations.value.findIndex(a => a.id === ann.id)
  if (idx >= 0) allAnnotations.value[idx] = { ...ann }
}

async function restoreAnnotation(ann: Annotation) {
  ann.deleted = false
  await db.ann.put({ id: ann.id, data: JSON.stringify(ann) })
  const idx = allAnnotations.value.findIndex(a => a.id === ann.id)
  if (idx >= 0) allAnnotations.value[idx] = { ...ann }
}

async function permanentlyDeleteAnnotation(ann: Annotation) {
  await db.ann.delete(ann.id)
  allAnnotations.value = allAnnotations.value.filter(a => a.id !== ann.id)
}

async function clearTrash() {
  const ids = deletedAnnotations.value.map(a => a.id)
  await Promise.all(ids.map(id => db.ann.delete(id)))
  allAnnotations.value = allAnnotations.value.filter(a => !a.deleted)
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
  // trigger reactivity
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

async function batchDelete() {
  for (const id of selectedIds.value) {
    const ann = allAnnotations.value.find(a => a.id === id)
    if (ann) {
      ann.deleted = true
      await db.ann.put({ id: ann.id, data: JSON.stringify(ann) })
      const idx = allAnnotations.value.findIndex(a => a.id === ann.id)
      if (idx >= 0) allAnnotations.value[idx] = { ...ann }
    }
  }
  clearSelection()
}

async function batchRestore() {
  for (const id of selectedIds.value) {
    const ann = allAnnotations.value.find(a => a.id === id)
    if (ann) {
      ann.deleted = false
      await db.ann.put({ id: ann.id, data: JSON.stringify(ann) })
      const idx = allAnnotations.value.findIndex(a => a.id === ann.id)
      if (idx >= 0) allAnnotations.value[idx] = { ...ann }
    }
  }
  clearSelection()
}

async function batchPermanentDelete() {
  const ids = [...selectedIds.value]
  await Promise.all(ids.map(id => db.ann.delete(id)))
  allAnnotations.value = allAnnotations.value.filter(a => !ids.includes(a.id))
  clearSelection()
}

// ---- Lifecycle ----

onMounted(async () => {
  await bookshelf.loadBooks()
  await loadAnnotations()
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
