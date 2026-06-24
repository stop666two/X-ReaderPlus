<template>
  <div class="stats-view">
    <v-toolbar density="compact" color="surface" class="border-b">
      <v-toolbar-title>统计</v-toolbar-title>

      <v-spacer />

      <template v-if="recentDisplayItems.length > 0">
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

    <div class="stats-content pa-4">
      <div class="stats-grid">
        <!-- Total books -->
        <v-card>
          <v-card-text class="text-center">
            <div class="stat-number">{{ stats.totalBooks }}</div>
            <div class="stat-label">总藏书数</div>
            <v-icon size="32" color="primary">mdi-bookshelf</v-icon>
          </v-card-text>
        </v-card>

        <!-- Total word count -->
        <v-card>
          <v-card-text class="text-center">
            <div class="stat-number">{{ formatNumber(stats.totalWordCount) }}</div>
            <div class="stat-label">总字数</div>
            <v-icon size="32" color="primary">mdi-text</v-icon>
          </v-card-text>
        </v-card>

        <!-- Total reading time -->
        <v-card>
          <v-card-text class="text-center">
            <div class="stat-number">{{ formatTime(stats.totalReadingTime) }}</div>
            <div class="stat-label">总阅读时间</div>
            <v-icon size="32" color="primary">mdi-clock-outline</v-icon>
          </v-card-text>
        </v-card>

        <!-- Format distribution -->
        <v-card class="format-card" title="格式分布">
          <v-card-text>
            <div v-if="Object.keys(stats.formatDistribution).length === 0" class="text-center py-4">
              <p class="text-medium-emphasis">暂无数据</p>
            </div>
            <div v-else>
              <div
                v-for="(count, format) in stats.formatDistribution"
                :key="format"
                class="format-row"
              >
                <span class="format-name">{{ format.toUpperCase() }}</span>
                <div class="format-bar-wrapper">
                  <div
                    class="format-bar"
                    :style="{ width: getBarWidth(count) + '%' }"
                  />
                </div>
                <span class="format-count">{{ count }}</span>
              </div>
            </div>
          </v-card-text>
        </v-card>

        <!-- Recently added -->
        <v-card title="最近添加" class="recent-card">
          <v-card-text>
            <v-list v-if="recentDisplayItems.length > 0" density="compact">
              <v-list-item
                v-for="item in recentDisplayItems"
                :key="item.bookId"
                :class="{ 'deleted-item': item.deleted }"
              >
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
                  {{ item.author }}
                </v-list-item-subtitle>

                <template #append>
                  <span class="text-caption">{{ formatDate(item.addedAt) }}</span>
                </template>
              </v-list-item>
            </v-list>
            <div v-else class="text-center py-4">
              <p class="text-medium-emphasis">暂无书籍</p>
            </div>
          </v-card-text>
        </v-card>
      </div>
    </div>

    <!-- Confirm dialogs -->
    <v-dialog v-model="showClearAllDialog" max-width="400">
      <v-card>
        <v-card-title>确认清除</v-card-title>
        <v-card-text>确定要清除本页所有统计数据吗？此操作不可撤销。</v-card-text>
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
        <v-card-text>确定要清除所有已删除文件的记录吗？</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showClearDeletedDialog = false">取消</v-btn>
          <v-btn color="error" variant="tonal" @click="doClearDeleted">确认清除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useBookshelfStore } from '@/stores/bookshelf'
import { getStatsData, clearAllStats, clearDeletedStats, type StatsEntry } from '@/services/stats'
import dayjs from 'dayjs'

const bookshelf = useBookshelfStore()

interface DisplayItem extends StatsEntry {
  deleted: boolean
}

const recentDisplayItems = ref<DisplayItem[]>([])
const showClearAllDialog = ref(false)
const showClearDeletedDialog = ref(false)

const deletedCount = computed(() => recentDisplayItems.value.filter(i => i.deleted).length)

const stats = computed(() => {
  const totalBooks = bookshelf.books.length
  const totalWordCount = bookshelf.books.reduce((sum, b) => sum + (b.wordCount || 0), 0)
  const totalReadingTime = bookshelf.books.reduce((sum, b) => sum + (b.totalReadingTime || 0), 0)

  const formatDistribution: Record<string, number> = {}
  bookshelf.books.forEach(b => {
    formatDistribution[b.format] = (formatDistribution[b.format] || 0) + 1
  })

  return { totalBooks, totalWordCount, totalReadingTime, formatDistribution }
})

async function loadRecent() {
  const entries = await getStatsData()
  const existingIds = new Set(bookshelf.books.map(b => b.id))
  recentDisplayItems.value = entries
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(0, 10)
    .map(e => ({ ...e, deleted: !existingIds.has(e.bookId) }))
}

function formatNumber(n: number): string {
  if (n >= 10000) {
    return (n / 10000).toFixed(1) + '万'
  }
  return n.toLocaleString()
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
  return `${(seconds / 3600).toFixed(1)}小时`
}

function getBarWidth(count: number): number {
  const max = Math.max(...Object.values(stats.value.formatDistribution))
  return max > 0 ? (count / max) * 100 : 0
}

function formatDate(ts: number): string {
  return dayjs(ts).format('MM-DD')
}

// Clear dialogs
function confirmClearAll() {
  showClearAllDialog.value = true
}
async function doClearAll() {
  await clearAllStats()
  showClearAllDialog.value = false
  await loadRecent()
}

function confirmClearDeleted() {
  showClearDeletedDialog.value = true
}
async function doClearDeleted() {
  const existingIds = new Set(bookshelf.books.map(b => b.id))
  await clearDeletedStats(existingIds)
  showClearDeletedDialog.value = false
  await loadRecent()
}

onMounted(async () => {
  bookshelf.loadBooks()
  await loadRecent()
})

watch(() => bookshelf.books.length, () => {
  loadRecent()
})
</script>

<style scoped>
.stats-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.stats-content {
  flex: 1;
  overflow-y: auto;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.stat-number {
  font-size: 32px;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
}

.stat-label {
  font-size: 14px;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.6;
  margin-bottom: 8px;
}

.format-card,
.recent-card {
  grid-column: span 2;
}

@media (max-width: 700px) {
  .format-card,
  .recent-card {
    grid-column: span 1;
  }
}

.format-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.format-name {
  width: 60px;
  font-size: 13px;
  font-weight: 500;
  flex-shrink: 0;
}

.format-bar-wrapper {
  flex: 1;
  height: 8px;
  background: rgb(var(--v-theme-border));
  border-radius: 4px;
  overflow: hidden;
}

.format-bar {
  height: 100%;
  background: rgb(var(--v-theme-primary));
  border-radius: 4px;
  transition: width 0.3s ease;
}

.format-count {
  width: 30px;
  text-align: right;
  font-size: 13px;
  flex-shrink: 0;
}

.deleted-item {
  opacity: 0.6;
}
</style>
