<template>
  <div class="history-view">
    <v-toolbar density="compact" color="surface" class="border-b">
      <v-toolbar-title>阅读历史</v-toolbar-title>

      <v-spacer />

      <template v-if="historyItems.length > 0">
        <v-btn
          v-if="selectedIds.size > 0"
          variant="tonal"
          color="error"
          size="small"
          class="mr-2"
          @click="confirmDeleteSelected"
        >
          <v-icon start size="18">mdi-delete</v-icon>
          删除选中 ({{ selectedIds.size }})
        </v-btn>

        <v-btn
          variant="text"
          size="small"
          class="mr-1"
          @click="confirmClearAll"
        >
          <v-icon start size="18">mdi-delete-sweep</v-icon>
          清除本页所有数据
        </v-btn>

        <v-btn
          v-if="deletedCount > 0"
          variant="text"
          size="small"
          @click="confirmClearDeleted"
        >
          <v-icon start size="18">mdi-delete-off</v-icon>
          仅清除已删除文件
        </v-btn>
      </template>
    </v-toolbar>

    <div class="history-content pa-4">
      <div v-if="historyItems.length === 0" class="text-center py-8">
        <v-icon size="64" class="mb-2" color="medium-emphasis">mdi-history</v-icon>
        <p class="text-medium-emphasis">暂无阅读记录</p>
        <p class="text-caption text-medium-emphasis">开始阅读后，最近阅读的书籍会显示在这里</p>
      </div>

      <v-list v-else density="compact">
        <v-list-item
          v-for="item in historyItems"
          :key="item.bookId"
          :class="{ 'deleted-item': item.deleted }"
          @click="!item.deleted && goToBook(item.bookId)"
        >
          <template #prepend>
            <v-checkbox
              v-model="selectedArr"
              :value="item.bookId"
              density="compact"
              hide-details
              class="mr-1"
              @click.stop
            />
            <div class="history-cover">
              <img v-if="item.cover" :src="item.cover" class="cover-img" />
              <v-icon v-else size="32">mdi-book</v-icon>
            </div>
          </template>

          <v-list-item-title>
            {{ item.title }}
            <v-chip
              v-if="item.deleted"
              size="x-small"
              color="error"
              variant="tonal"
              class="ml-2"
            >
              已删除
            </v-chip>
          </v-list-item-title>
          <v-list-item-subtitle>
            {{ item.author }} · {{ item.format.toUpperCase() }}
          </v-list-item-subtitle>

          <template #append>
            <div class="text-right">
              <div class="text-caption">
                {{ formatDate(item.lastReadAt) }}
              </div>
              <div class="text-caption text-medium-emphasis">
                阅读 {{ formatTime(item.totalReadingTime) }}
              </div>
              <div class="history-progress-bar mt-1">
                <div class="history-progress-fill" :style="{ width: (item.progress * 100) + '%' }" />
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ Math.round(item.progress * 100) }}%
              </div>
            </div>
          </template>
        </v-list-item>
      </v-list>
    </div>

    <!-- Confirm dialogs -->
    <v-dialog v-model="showClearAllDialog" max-width="400">
      <v-card>
        <v-card-title>确认清除</v-card-title>
        <v-card-text>确定要清除本页所有阅读历史数据吗？此操作不可撤销。</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showClearAllDialog = false">取消</v-btn>
          <v-btn color="error" variant="tonal" @click="doClearAll">确认清除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showClearDeletedDialog" max-width="400">
      <v-card>
        <v-card-title>确认清除</v-card-title>
        <v-card-text>确定要清除所有已删除文件的阅读记录吗？</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showClearDeletedDialog = false">取消</v-btn>
          <v-btn color="error" variant="tonal" @click="doClearDeleted">确认清除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showDeleteSelectedDialog" max-width="400">
      <v-card>
        <v-card-title>确认删除</v-card-title>
        <v-card-text>确定要删除选中的 {{ selectedIds.size }} 条历史记录吗？</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showDeleteSelectedDialog = false">取消</v-btn>
          <v-btn color="error" variant="tonal" @click="doDeleteSelected">确认删除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useBookshelfStore } from '@/stores/bookshelf'
import { getHistory, clearAllHistory, clearDeletedHistory, removeHistoryEntries, type HistoryEntry } from '@/services/history'
import dayjs from 'dayjs'

const router = useRouter()
const bookshelf = useBookshelfStore()

interface DisplayItem extends HistoryEntry {
  deleted: boolean
}

const historyItems = ref<DisplayItem[]>([])
const selectedArr = ref<string[]>([])
const showClearAllDialog = ref(false)
const showClearDeletedDialog = ref(false)
const showDeleteSelectedDialog = ref(false)

const selectedIds = computed(() => new Set(selectedArr.value))

const deletedCount = computed(() => historyItems.value.filter(i => i.deleted).length)

async function loadHistory() {
  const entries = await getHistory()
  const existingIds = new Set(bookshelf.books.map(b => b.id))
  historyItems.value = entries
    .filter(e => e.lastReadAt > 0)
    .sort((a, b) => b.lastReadAt - a.lastReadAt)
    .map(e => ({ ...e, deleted: !existingIds.has(e.bookId) }))
}

function goToBook(id: string) {
  router.push({ name: 'reader', params: { id } })
}

function formatDate(ts: number): string {
  if (!ts) return '未阅读'
  return dayjs(ts).format('YYYY-MM-DD HH:mm')
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
  return `${(seconds / 3600).toFixed(1)}小时`
}

// Clear dialogs
function confirmClearAll() {
  showClearAllDialog.value = true
}
async function doClearAll() {
  await clearAllHistory()
  showClearAllDialog.value = false
  selectedArr.value = []
  await loadHistory()
}

function confirmClearDeleted() {
  showClearDeletedDialog.value = true
}
async function doClearDeleted() {
  const existingIds = new Set(bookshelf.books.map(b => b.id))
  await clearDeletedHistory(existingIds)
  showClearDeletedDialog.value = false
  selectedArr.value = []
  await loadHistory()
}

// Batch delete
function confirmDeleteSelected() {
  showDeleteSelectedDialog.value = true
}
async function doDeleteSelected() {
  await removeHistoryEntries([...selectedIds.value])
  showDeleteSelectedDialog.value = false
  selectedArr.value = []
  await loadHistory()
}

onMounted(async () => {
  bookshelf.loadBooks()
  await loadHistory()
})

// Reload when books change (e.g., deletion restores would affect deleted status)
watch(() => bookshelf.books.length, () => {
  loadHistory()
})
</script>

<style scoped>
.history-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.history-content {
  flex: 1;
  overflow-y: auto;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.history-cover {
  width: 40px;
  height: 56px;
  overflow: hidden;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.history-progress-bar {
  width: 100px;
  height: 3px;
  background: rgb(var(--v-theme-border));
  border-radius: 2px;
  overflow: hidden;
}

.history-progress-fill {
  height: 100%;
  background: rgb(var(--v-theme-primary));
  border-radius: 2px;
}

.deleted-item {
  opacity: 0.6;
}
</style>
