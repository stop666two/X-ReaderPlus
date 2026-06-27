<template>
  <div class="tags-view">
    <!-- Toolbar -->
    <v-toolbar density="compact" color="surface" class="border-b">
      <v-toolbar-title>标签管理</v-toolbar-title>

      <v-spacer />

      <!-- Sort toggle -->
      <v-btn-toggle
        v-model="sortMode"
        mandatory
        density="compact"
        variant="outlined"
        divided
        class="mr-2"
      >
        <v-btn :value="0" size="small">
          <v-icon start size="18">mdi-sort-alphabetical-ascending</v-icon>
          名称
        </v-btn>
        <v-btn :value="1" size="small">
          <v-icon start size="18">mdi-sort-numeric-descending</v-icon>
          数量
        </v-btn>
      </v-btn-toggle>

      <!-- Search -->
      <v-text-field
        v-model="searchQuery"
        placeholder="搜索标签..."
        prepend-inner-icon="mdi-magnify"
        hide-details
        density="compact"
        variant="outlined"
        class="search-field"
        clearable
      />

      <v-spacer />

      <!-- Batch delete -->
      <v-btn
        v-if="selectedTags.size > 0"
        color="error"
        variant="tonal"
        size="small"
        class="mr-2"
        @click="batchDeleteConfirm = true"
      >
        <v-icon start size="18">mdi-delete</v-icon>
        删除 ({{ selectedTags.size }})
      </v-btn>

      <!-- New tag -->
      <v-btn
        color="primary"
        variant="tonal"
        size="small"
        @click="openCreateDialog"
      >
        <v-icon start size="18">mdi-plus</v-icon>
        新建标签
      </v-btn>
    </v-toolbar>

    <!-- Content -->
    <div class="tags-content pa-4">
      <!-- Empty state -->
      <div v-if="sortedTags.length === 0" class="text-center py-12">
        <v-icon size="64" color="text-medium-emphasis" class="mb-4">mdi-tag-off</v-icon>
        <p class="text-medium-emphasis">{{ searchQuery ? '没有匹配的标签' : '暂无标签' }}</p>
        <p class="text-caption text-medium-emphasis">在书籍详情中为书籍添加标签，或点击上方按钮新建</p>
      </div>

      <!-- Tag chips -->
      <div v-else class="tags-grid">
        <div
          v-for="tag in pagedTags"
          :key="tag.name"
          class="tag-card"
          :class="{ expanded: expandedTag === tag.name }"
        >
          <!-- Tag chip header -->
          <div
            class="tag-chip-header"
            :style="{ backgroundColor: getTagColor(tag.name) }"
            @click="toggleExpand(tag.name)"
          >
            <div class="tag-chip-left">
              <v-checkbox
                v-model="selectedTagsSet"
                :value="tag.name"
                density="compact"
                hide-details
                color="white"
                class="tag-checkbox"
                @click.stop
              />
              <v-icon class="tag-icon" size="20">mdi-tag</v-icon>
              <span class="tag-name">{{ tag.name }}</span>
              <v-chip size="x-small" class="tag-count-chip ml-1">{{ tag.count }}</v-chip>
            </div>
            <div class="tag-chip-right">
              <v-btn
                icon="mdi-chevron-down"
                size="x-small"
                variant="text"
                density="compact"
                class="expand-btn"
                :class="{ rotated: expandedTag === tag.name }"
                @click.stop="toggleExpand(tag.name)"
              />
            </div>
            <div class="tag-chip-actions" @click.stop>
              <v-btn
                icon="mdi-pencil"
                size="x-small"
                variant="text"
                density="compact"
                class="action-btn"
                @click="openRenameDialog(tag.name)"
              />
              <v-btn
                icon="mdi-delete"
                size="x-small"
                variant="text"
                density="compact"
                class="action-btn"
                color="error"
                @click="confirmDeleteSingle(tag.name)"
              />
            </div>
          </div>

          <!-- Expanded book list -->
          <v-expand-transition>
            <div v-if="expandedTag === tag.name" class="tag-books">
              <div v-if="getTagBooks(tag.name).length === 0" class="text-center py-4">
                <p class="text-caption text-medium-emphasis">没有书籍使用此标签</p>
              </div>
              <v-list v-else density="compact" class="book-list">
                <v-list-item
                  v-for="book in pagedTagBooks(tag.name)"
                  :key="book.id"
                  class="book-item"
                  @click="openBook(book.id)"
                >
                  <template #prepend>
                    <div class="book-thumb">
                      <img
                        v-if="book.cover"
                        :src="book.cover"
                        class="book-cover"
                        @error="onCoverError"
                      />
                      <div v-else class="book-cover-placeholder">
                        <v-icon size="24">mdi-book</v-icon>
                      </div>
                    </div>
                  </template>

                  <template #title>
                    <span class="book-title">{{ book.title || '未命名' }}</span>
                  </template>

                  <template #subtitle>
                    <span class="book-meta">
                      {{ book.author || '未知作者' }} &middot;
                      <v-chip size="x-small" variant="tonal" class="format-chip">{{ book.format }}</v-chip>
                    </span>
                  </template>

                  <template #append>
                    <v-icon size="18" color="text-medium-emphasis">mdi-chevron-right</v-icon>
                  </template>
                </v-list-item>
              </v-list>
            </div>
          </v-expand-transition>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination-bar">
        <v-btn size="x-small" icon="mdi-chevron-left" :disabled="!hasPrev" @click="prevPage" />
        <span class="text-caption mx-2">第 {{ currentPage }} / {{ totalPages }} 页</span>
        <v-btn size="x-small" icon="mdi-chevron-right" :disabled="!hasNext" @click="nextPage" />
      </div>
    </div>

    <!-- Create dialog -->
    <v-dialog v-model="showCreate" max-width="400">
      <v-card>
        <v-card-title>新建标签</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newTagName"
            label="标签名称"
            variant="outlined"
            hide-details
            autofocus
            @keyup.enter="createTag"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showCreate = false">取消</v-btn>
          <v-btn
            color="primary"
            @click="createTag"
            :disabled="!newTagName.trim()"
          >
            创建
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Rename dialog -->
    <v-dialog v-model="showRename" max-width="400">
      <v-card>
        <v-card-title>重命名标签</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="renameValue"
            label="新名称"
            variant="outlined"
            hide-details
            autofocus
            @keyup.enter="confirmRename"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showRename = false">取消</v-btn>
          <v-btn
            color="primary"
            @click="confirmRename"
            :disabled="!renameValue.trim() || renameValue.trim() === renameOldName"
          >
            确认
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete confirmation -->
    <v-dialog v-model="showDelete" max-width="400">
      <v-card>
        <v-card-title>删除标签</v-card-title>
        <v-card-text>
          确定要删除标签 <strong>"{{ deleteTarget }}"</strong> 吗？
          此操作将从 {{ getTagBooks(deleteTarget).length }} 本书中移除该标签。
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showDelete = false">取消</v-btn>
          <v-btn color="error" @click="deleteTag">删除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Batch delete confirmation -->
    <v-dialog v-model="batchDeleteConfirm" max-width="400">
      <v-card>
        <v-card-title>批量删除标签</v-card-title>
        <v-card-text>
          确定要删除选中的 <strong>{{ selectedTags.size }}</strong> 个标签吗？
          此操作将从相关书籍中移除这些标签。
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="batchDeleteConfirm = false">取消</v-btn>
          <v-btn color="error" @click="batchDelete">删除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useBookshelfStore } from '@/stores/bookshelf'
import { usePagination } from '@/composables/usePagination'
import type { Book } from '@/types'

const router = useRouter()
const bookshelf = useBookshelfStore()

// ── State ──
const searchQuery = ref('')
const sortMode = ref(0) // 0 = name, 1 = count
const expandedTag = ref('')
const selectedTagsSet = ref<string[]>([])
const showCreate = ref(false)
const showRename = ref(false)
const showDelete = ref(false)
const batchDeleteConfirm = ref(false)
const newTagName = ref('')
const renameOldName = ref('')
const renameValue = ref('')
const deleteTarget = ref('')
const tagsPageSize = ref(20)

const selectedTags = computed(() => new Set(selectedTagsSet.value))

// ── Tag color hash ──
function hashString(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function getTagColor(name: string): string {
  const h = hashString(name)
  const hue = h % 360
  const saturation = 55 + (h % 30)
  const lightness = 28 + (h % 16)
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

// ── Computed tag list with counts ──
const tagCountMap = computed(() => {
  const map = new Map<string, number>()
  bookshelf.books.forEach(b => {
    b.tags.forEach(t => {
      map.set(t, (map.get(t) || 0) + 1)
    })
  })
  return map
})

const sortedTags = computed(() => {
  let tags = Array.from(tagCountMap.value.entries())
    .map(([name, count]) => ({ name, count }))

  // Filter by search
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    tags = tags.filter(t => t.name.toLowerCase().includes(q))
  }

  // Sort
  if (sortMode.value === 0) {
    tags.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  } else {
    tags.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
  }

  return tags
})

// ── Pagination for tags ──
const {
  currentPage,
  totalPages,
  hasPrev,
  hasNext,
  pagedItems: pagedTags,
  prevPage,
  nextPage
} = usePagination(sortedTags, tagsPageSize, {
  onPageChange: () => { nextTick(() => {
    const el = document.querySelector('.tags-content')
    if (el) el.scrollTop = 0
  })}
})

// ── Books per tag (with pagination for expanded tag's book list) ──
const tagBookPages = ref<Map<string, number>>(new Map())
const tagBookPageSize = 10

function getTagBooks(tag: string): Book[] {
  return bookshelf.books.filter(b => b.tags.includes(tag))
}

function pagedTagBooks(tag: string): Book[] {
  const books = getTagBooks(tag)
  const page = tagBookPages.value.get(tag) || 1
  const start = (page - 1) * tagBookPageSize
  return books.slice(start, start + tagBookPageSize)
}

// ── Expand / collapse ──
function toggleExpand(tag: string) {
  if (expandedTag.value === tag) {
    expandedTag.value = ''
  } else {
    expandedTag.value = tag
    // Reset book page for this tag
    if (!tagBookPages.value.has(tag)) {
      tagBookPages.value.set(tag, 1)
    }
  }
}

// ── Create ──
function openCreateDialog() {
  newTagName.value = ''
  showCreate.value = true
}

async function createTag() {
  const name = newTagName.value.trim()
  if (!name) return
  if (tagCountMap.value.has(name)) {
    showCreate.value = false
    return
  }
  // Add the new tag via bookshelf store
  await bookshelf.createTag(name)
  showCreate.value = false
}

// ── Rename ──
function openRenameDialog(name: string) {
  renameOldName.value = name
  renameValue.value = name
  showRename.value = true
}

async function confirmRename() {
  const newName = renameValue.value.trim()
  if (!newName || newName === renameOldName.value) {
    showRename.value = false
    return
  }

  const oldName = renameOldName.value
  for (const book of bookshelf.books) {
    if (book.tags.includes(oldName)) {
      const newTags = book.tags.map(t => (t === oldName ? newName : t))
      await bookshelf.updateBook(book.id, { tags: newTags })
    }
  }

  if (expandedTag.value === oldName) expandedTag.value = newName
  showRename.value = false
}

// ── Delete single ──
function confirmDeleteSingle(name: string) {
  deleteTarget.value = name
  showDelete.value = true
}

async function deleteTag() {
  const name = deleteTarget.value
  for (const book of bookshelf.books) {
    if (book.tags.includes(name)) {
      const newTags = book.tags.filter(t => t !== name)
      await bookshelf.updateBook(book.id, { tags: newTags })
    }
  }
  if (expandedTag.value === name) expandedTag.value = ''
  selectedTagsSet.value = selectedTagsSet.value.filter(t => t !== name)
  showDelete.value = false
}

// ── Batch delete ──
async function batchDelete() {
  const names = Array.from(selectedTags.value)
  for (const name of names) {
    for (const book of bookshelf.books) {
      if (book.tags.includes(name)) {
        const newTags = book.tags.filter(t => t !== name)
        await bookshelf.updateBook(book.id, { tags: newTags })
      }
    }
    if (expandedTag.value === name) expandedTag.value = ''
  }
  selectedTagsSet.value = []
  batchDeleteConfirm.value = false
}

// ── Navigate to book ──
function openBook(bookId: string) {
  router.push({ name: 'reader', params: { id: bookId } })
}

// ── Cover error ──
function onCoverError(e: Event) {
  const img = e.target as HTMLImageElement
  img.style.display = 'none'
  const parent = img.parentElement
  if (parent) {
    const placeholder = parent.querySelector('.book-cover-placeholder')
    if (placeholder) (placeholder as HTMLElement).style.display = 'flex'
  }
}

// ── Lifecycle ──
onMounted(() => {
  bookshelf.loadBooks()
})
</script>

<style scoped>
.tags-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.search-field {
  max-width: 220px;
}

.tags-content {
  flex: 1;
  overflow-y: auto;
}

.tags-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── Pagination ── */

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 0;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.06);
  margin-top: 8px;
}

/* ── Tag chip card ── */
.tag-card {
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  transition: box-shadow 0.2s;
}

.tag-card.expanded {
  box-shadow: 0 2px 10px rgba(0,0,0,0.12);
}

.tag-chip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  min-height: 44px;
  transition: filter 0.15s;
  position: relative;
}

.tag-chip-header:hover {
  filter: brightness(1.08);
}

.tag-chip-left {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.tag-checkbox {
  flex-shrink: 0;
}

.tag-checkbox :deep(.v-selection-control) {
  min-height: unset;
}

.tag-icon {
  color: rgba(255,255,255,0.85);
  flex-shrink: 0;
}

.tag-name {
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag-count-chip {
  background: rgba(255,255,255,0.3) !important;
  color: #fff !important;
  font-weight: 600;
  flex-shrink: 0;
}

.tag-chip-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.expand-btn {
  color: rgba(255,255,255,0.9) !important;
  transition: transform 0.3s;
}

.expand-btn.rotated {
  transform: rotate(180deg);
}

.tag-chip-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: 4px;
}

.action-btn {
  color: rgba(255,255,255,0.8) !important;
}

.action-btn:hover {
  color: #fff !important;
}

/* ── Expanded book list ── */
.tag-books {
  background: rgb(var(--v-theme-surface));
  border-top: 1px solid rgba(0,0,0,0.06);
}

.book-list {
  padding: 0;
}

.book-item {
  cursor: pointer;
  transition: background 0.15s;
}

.book-item:hover {
  background: rgba(var(--v-theme-primary), 0.04);
}

.book-thumb {
  width: 36px;
  height: 50px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(0,0,0,0.06);
}

.book-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.book-cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: rgba(0,0,0,0.3);
}

.book-title {
  font-size: 13px;
  font-weight: 500;
}

.book-meta {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  display: flex;
  align-items: center;
  gap: 4px;
}

.format-chip {
  font-size: 10px !important;
  height: 18px !important;
}
</style>
