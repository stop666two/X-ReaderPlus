<template>
  <div class="trash-view">
    <v-toolbar density="compact" color="surface" class="border-b">
      <v-toolbar-title>回收站</v-toolbar-title>
      <v-spacer />
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
          v-for="item in trashItems"
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
import { ref, computed, onMounted } from 'vue'
import { db } from '@/services/db'
import type { TrashItem } from '@/types'
import { useBookshelfStore } from '@/stores/bookshelf'
import { batchProcess } from '@/stores/bookshelf'
import dayjs from 'dayjs'

const bookshelf = useBookshelfStore()
const trashItems = ref<TrashItem[]>([])
const showClearConfirm = ref(false)
const showBatchDeleteConfirm = ref(false)
const showSingleDeleteConfirm = ref(false)
const singleDeleteTarget = ref<TrashItem | null>(null)
const clearingInProgress = ref(false)
const clearProgress = ref({ current: 0, total: 0 })
const selectedTrashIds = ref<Set<string>>(new Set())

const clearProgressPercent = computed(() => {
  if (clearProgress.value.total === 0) return 0
  return (clearProgress.value.current / clearProgress.value.total) * 100
})

// ---- Selection ----

function toggleTrashSelect(id: string) {
  const s = new Set(selectedTrashIds.value)
  s.has(id) ? s.delete(id) : s.add(id)
  selectedTrashIds.value = s
}

function selectAllTrash() {
  selectedTrashIds.value = new Set(trashItems.value.map(t => t.id))
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

// ---- Load ----

async function loadTrash() {
  const records = await db.tr.toArray()
  trashItems.value = records.map(r => JSON.parse(r.data))
}

// ---- Restore ----

async function restoreItem(id: string) {
  const record = await db.tr.get(id)
  if (record) {
    const item: TrashItem = JSON.parse(record.data)
    await db.lib.put({ id, data: JSON.stringify(item.book) })
    await db.tr.delete(id)
    selectedTrashIds.value.delete(id)
    selectedTrashIds.value = new Set(selectedTrashIds.value)
    await loadTrash()
    await bookshelf.loadBooks()
  }
}

async function batchRestore() {
  const ids = [...selectedTrashIds.value]
  await batchProcess(
    ids,
    50,
    async (id) => {
      const record = await db.tr.get(id)
      if (record) {
        const item: TrashItem = JSON.parse(record.data)
        await db.lib.put({ id, data: JSON.stringify(item.book) })
        await db.tr.delete(id)
      }
    }
  )
  clearTrashSelection()
  await loadTrash()
  await bookshelf.loadBooks()
}

// ---- Delete ----

async function permanentlyDelete(id: string) {
  const record = await db.tr.get(id)
  if (record) {
    const item: TrashItem = JSON.parse(record.data)
    await db.tr.delete(id)
    await db.ch.delete(item.book.id)
    await db.bm.filter(x => {
      try { const bm = JSON.parse(x.data); return bm.bookId === item.book.id } catch { return false }
    }).delete()
    await db.ann.filter(x => {
      try { const ann = JSON.parse(x.data); return ann.bookId === item.book.id } catch { return false }
    }).delete()
  }
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
  await batchProcess(ids, 50, (id) => permanentlyDelete(id))
  clearTrashSelection()
  await loadTrash()
}

async function clearTrash() {
  showClearConfirm.value = false
  clearingInProgress.value = true
  const ids = trashItems.value.map(t => t.id)
  clearProgress.value = { current: 0, total: ids.length }

  await batchProcess(
    ids,
    50,
    async (id) => {
      await permanentlyDelete(id)
      clearProgress.value = { current: clearProgress.value.current + 1, total: ids.length }
    }
  )

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

onMounted(loadTrash)
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
