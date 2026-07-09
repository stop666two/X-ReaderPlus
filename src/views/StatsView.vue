<template>
  <div class="stats-view">
    <v-toolbar density="compact" color="surface" class="border-b">
      <v-toolbar-title>统计</v-toolbar-title>
      <v-spacer />
      <template v-if="allRecentItems.length > 0">
        <v-btn variant="text" size="small" class="mr-1" @click="confirmClearAll">
          <v-icon start size="18">mdi-delete-sweep</v-icon>清除所有数据
        </v-btn>
        <v-btn v-if="deletedCount > 0" variant="text" size="small" @click="confirmClearDeleted">
          <v-icon start size="18">mdi-delete-off</v-icon>仅清除已删除文件
        </v-btn>
      </template>
      <v-btn
        variant="outlined"
        color="warning"
        size="small"
        :loading="cleaningOrphans"
        class="ml-1"
        @click="cleanupOrphans"
      >
        <v-icon start size="18">mdi-delete-restore</v-icon>
        清理失效数据
      </v-btn>
    </v-toolbar>

    <div class="stats-content pa-4">
      <!-- Top overview cards -->
      <div class="stats-grid">
        <v-card><v-card-text class="text-center">
          <div class="stat-number">{{ stats.totalBooks }}</div>
          <div class="stat-label">总藏书数</div>
          <v-icon size="32" color="primary">mdi-bookshelf</v-icon>
        </v-card-text></v-card>
        <v-card><v-card-text class="text-center">
          <div class="stat-number">{{ formatNumber(stats.totalWordCount) }}</div>
          <div class="stat-label">总字数</div>
          <v-icon size="32" color="primary">mdi-text</v-icon>
        </v-card-text></v-card>
        <v-card><v-card-text class="text-center">
          <div class="stat-number">{{ formatTime(stats.totalReadingTime) }}</div>
          <div class="stat-label">总阅读时间</div>
          <v-icon size="32" color="primary">mdi-clock-outline</v-icon>
        </v-card-text></v-card>
      </div>

      <!-- Reading Calendar Heatmap -->
      <v-card class="mt-4" title="阅读日历">
        <v-card-text>
          <div v-if="heatmapWeeks.length === 0" class="text-center py-4 text-medium-emphasis">暂无阅读数据</div>
          <div v-else class="heatmap-wrapper">
            <div class="heatmap-months">
              <span v-for="(label, i) in monthLabels" :key="i" class="heatmap-month-label">{{ label }}</span>
            </div>
            <div class="heatmap-body">
              <div class="heatmap-day-labels">
                <span class="day-label">一</span><span class="day-label">三</span><span class="day-label">五</span>
              </div>
              <svg :width="heatmapSvgWidth" :height="heatmapSvgHeight" class="heatmap-svg">
                <g v-for="(week, wi) in heatmapWeeks" :key="wi">
                  <rect
                    v-for="(day, di) in week"
                    :key="di"
                    :x="wi * 16"
                    :y="di * 16"
                    width="13"
                    height="13"
                    :rx="2"
                    :fill="getHeatmapColor(day.minutes)"
                    :title="day.date ? `${day.date}: ${day.minutes}分钟` : ''"
                  />
                </g>
              </svg>
            </div>
            <div class="heatmap-legend">
              <span class="text-caption text-medium-emphasis">少</span>
              <svg width="120" height="12" class="ml-1 mr-1"><defs><linearGradient id="heatGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#ebedf0"/><stop offset="25%" stop-color="#9be9a8"/><stop offset="50%" stop-color="#40c463"/><stop offset="75%" stop-color="#30a14e"/><stop offset="100%" stop-color="#216e39"/></linearGradient></defs><rect width="120" height="12" rx="2" fill="url(#heatGrad)"/></svg>
              <span class="text-caption text-medium-emphasis">多</span>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <!-- Reading Stats Charts -->
      <v-row class="mt-4">
        <v-col cols="12" md="6">
          <v-card title="本周阅读">
            <v-card-text>
              <div class="chart-bar-container">
                <div v-for="(d, i) in weeklyStats" :key="i" class="chart-bar-col">
                  <div class="chart-bar-value text-caption">{{ d.minutes > 0 ? d.minutes + '分' : '' }}</div>
                  <div class="chart-bar-track">
                    <div class="chart-bar-fill" :style="{ height: getWeeklyBarHeight(d.minutes) + '%' }" />
                  </div>
                  <div class="chart-bar-label text-caption">{{ d.dayLabel }}</div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="6">
          <v-card title="格式分布">
            <v-card-text>
              <div v-if="Object.keys(stats.formatDistribution).length === 0" class="text-center py-4 text-medium-emphasis">暂无数据</div>
              <div v-else>
                <div v-for="(count, format) in stats.formatDistribution" :key="format" class="format-row">
                  <span class="format-name">{{ format.toUpperCase() }}</span>
                  <div class="format-bar-wrapper"><div class="format-bar" :style="{ width: getBarWidth(count) + '%' }" /></div>
                  <span class="format-count">{{ count }}</span>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Recently added -->
      <v-card class="mt-4" title="最近添加">
        <v-card-text>
          <v-list v-if="pagedRecentItems.length > 0" density="compact">
            <v-list-item v-for="item in pagedRecentItems" :key="item.bookId" :class="{ 'deleted-item': item.deleted }">
              <v-list-item-title>
                {{ item.title }}
                <v-chip v-if="item.deleted" size="x-small" color="error" variant="tonal" class="ml-2">已删除</v-chip>
              </v-list-item-title>
              <v-list-item-subtitle>{{ item.author }}</v-list-item-subtitle>
              <template #append><span class="text-caption">{{ formatDate(item.addedAt) }}</span></template>
            </v-list-item>
          </v-list>
          <div v-else class="text-center py-4 text-medium-emphasis">暂无书籍</div>
          <div v-if="totalPages > 1" class="pagination-bar">
            <v-btn size="x-small" icon="mdi-chevron-left" :disabled="!hasPrev" @click="prevPage" />
            <span class="text-caption mx-2">第 {{ currentPage }} / {{ totalPages }} 页</span>
            <v-btn size="x-small" icon="mdi-chevron-right" :disabled="!hasNext" @click="nextPage" />
          </div>
        </v-card-text>
      </v-card>
    </div>

    <v-dialog v-model="showClearAllDialog" max-width="400">
      <v-card><v-card-title>确认清除</v-card-title><v-card-text>确定要清除所有统计数据吗？此操作不可撤销。</v-card-text>
        <v-card-actions><v-spacer /><v-btn variant="text" @click="showClearAllDialog = false">取消</v-btn><v-btn color="error" variant="tonal" @click="doClearAll">确认清除</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="showClearDeletedDialog" max-width="400">
      <v-card><v-card-title>确认清除</v-card-title><v-card-text>确定要清除所有已删除文件的记录吗？</v-card-text>
        <v-card-actions><v-spacer /><v-btn variant="text" @click="showClearDeletedDialog = false">取消</v-btn><v-btn color="error" variant="tonal" @click="doClearDeleted">确认清除</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
    <v-snackbar v-model="showSnackbar" :timeout="3000">
      {{ snackbarText }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useBookshelfStore } from '@/stores/bookshelf'
import { getStatsData, clearAllStats, clearDeletedStats, type StatsEntry } from '@/services/stats'
import { usePagination } from '@/composables/usePagination'
import { BASE } from '@/services/api-bridge'
import dayjs from 'dayjs'

const API_STATS = BASE + '/api/stats'

const bookshelf = useBookshelfStore()
interface DisplayItem extends StatsEntry { deleted: boolean }

const allRecentItems = ref<DisplayItem[]>([])
const showClearAllDialog = ref(false)
const showClearDeletedDialog = ref(false)
const cleaningOrphans = ref(false)
const snackbarText = ref('')
const showSnackbar = ref(false)
const statsPageSize = ref(20)

const { currentPage, totalPages, hasPrev, hasNext, pagedItems: pagedRecentItems, prevPage, nextPage } = usePagination(allRecentItems, statsPageSize)
const deletedCount = computed(() => allRecentItems.value.filter(i => i.deleted).length)

const stats = computed(() => {
  const totalBooks = bookshelf.books.length
  const totalWordCount = bookshelf.books.reduce((sum, b) => sum + (b.wordCount || 0), 0)
  const totalReadingTime = bookshelf.books.reduce((sum, b) => sum + (b.totalReadingTime || 0), 0)
  const formatDistribution: Record<string, number> = {}
  bookshelf.books.forEach(b => { formatDistribution[b.format] = (formatDistribution[b.format] || 0) + 1 })
  return { totalBooks, totalWordCount, totalReadingTime, formatDistribution }
})

// ── Reading Calendar Heatmap ──
const TODAY = dayjs()
const HEATMAP_WEEKS = 26
const heatmapSvgWidth = computed(() => HEATMAP_WEEKS * 16 + 4)

interface HeatmapDay { date: string; minutes: number }
const dailyMinutes = ref<Record<string, number>>({})
const readingDays = ref<string[]>([])

const heatmapSvgHeight = 7 * 16 + 4

const monthLabels = computed(() => {
  const labels: string[] = []
  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    const d = TODAY.subtract((HEATMAP_WEEKS - 1 - w) * 7, 'day')
    if (w === 0 || d.month() !== TODAY.subtract((HEATMAP_WEEKS - w) * 7, 'day').month()) {
      labels.push(d.format('M月'))
    } else {
      labels.push('')
    }
  }
  return labels
})

const heatmapWeeks = computed(() => {
  const weeks: HeatmapDay[][] = []
  const startDate = TODAY.subtract((HEATMAP_WEEKS - 1) * 7 + 6, 'day')
  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    const week: HeatmapDay[] = []
    for (let d = 0; d < 7; d++) {
      const date = startDate.add(w * 7 + d, 'day')
      const key = date.format('YYYY-MM-DD')
      week.push({ date: key, minutes: dailyMinutes.value[key] || 0 })
    }
    weeks.push(week)
  }
  return weeks
})

function getHeatmapColor(minutes: number): string {
  if (minutes === 0) return '#ebedf0'
  if (minutes < 15) return '#9be9a8'
  if (minutes < 30) return '#40c463'
  if (minutes < 60) return '#30a14e'
  return '#216e39'
}

// ── Weekly Stats ──
interface WeekDay { dayLabel: string; minutes: number }
const weeklyStats = computed<WeekDay[]>(() => {
  const days: WeekDay[] = []
  const labels = ['一', '二', '三', '四', '五', '六', '日']
  const weekStart = TODAY.startOf('week').add(1, 'day')
  for (let i = 0; i < 7; i++) {
    const date = weekStart.add(i, 'day').format('YYYY-MM-DD')
    days.push({ dayLabel: labels[i], minutes: dailyMinutes.value[date] || 0 })
  }
  return days
})

function getWeeklyBarHeight(minutes: number): number {
  const max = Math.max(...weeklyStats.value.map(d => d.minutes), 1)
  return (minutes / max) * 100
}

async function loadReadingCalendar() {
  dailyMinutes.value = {}
  try {
    const resp = await fetch(API_STATS)
    if (!resp.ok) return
    const entries = await resp.json()
    if (Array.isArray(entries)) {
      for (const e of entries) {
        if (e.date) {
          const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
          dailyMinutes.value[e.date] = (data.minutesRead || 0)
        }
      }
    }
  } catch {}
}

// ── Recent Items ──
async function loadRecent() {
  const entries = await getStatsData()
  const existingIds = new Set(bookshelf.books.map(b => b.id))
  allRecentItems.value = entries.sort((a, b) => b.addedAt - a.addedAt).map(e => ({ ...e, deleted: !existingIds.has(e.bookId) }))
}

function formatNumber(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return n.toLocaleString()
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
  return `${(seconds / 3600).toFixed(1)}小时`
}

function getBarWidth(count: number): number {
  const max = Math.max(...Object.values(stats.value.formatDistribution), 1)
  return (count / max) * 100
}

function formatDate(ts: number): string { return dayjs(ts).format('MM-DD') }

function confirmClearAll() { showClearAllDialog.value = true }
async function doClearAll() { await clearAllStats(); showClearAllDialog.value = false; await loadRecent() }
function confirmClearDeleted() { showClearDeletedDialog.value = true }
async function doClearDeleted() {
  const existingIds = new Set(bookshelf.books.map(b => b.id))
  await clearDeletedStats(existingIds)
  showClearDeletedDialog.value = false
  await loadRecent()
}

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
  await Promise.all([bookshelf.loadBooks(), loadRecent(), loadReadingCalendar()])
})

watch(() => bookshelf.books.length, () => loadRecent())
</script>

<style scoped>
.stats-view { height: 100%; display: flex; flex-direction: column; }
.stats-content { flex: 1; overflow-y: auto; max-width: 900px; margin: 0 auto; width: 100%; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.stat-number { font-size: 32px; font-weight: 700; color: rgb(var(--v-theme-primary)); }
.stat-label { font-size: 14px; color: rgb(var(--v-theme-on-surface)); opacity: 0.6; margin-bottom: 8px; }

/* Heatmap */
.heatmap-wrapper { overflow-x: auto; }
.heatmap-months { display: flex; gap: 0; margin-left: 32px; height: 18px; }
.heatmap-month-label { width: 112px; font-size: 11px; color: rgb(var(--v-theme-on-surface)); opacity: 0.5; }
.heatmap-body { display: flex; }
.heatmap-day-labels { display: flex; flex-direction: column; gap: 3px; width: 24px; padding-right: 4px; }
.day-label { height: 13px; font-size: 10px; line-height: 13px; color: rgb(var(--v-theme-on-surface)); opacity: 0.5; text-align: right; }
.heatmap-svg { flex-shrink: 0; }
.heatmap-legend { display: flex; align-items: center; justify-content: flex-end; margin-top: 8px; }

/* Bar Chart */
.chart-bar-container { display: flex; align-items: flex-end; gap: 8px; height: 140px; padding: 0 4px; }
.chart-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
.chart-bar-value { height: 18px; line-height: 18px; color: rgb(var(--v-theme-primary)); font-weight: 500; }
.chart-bar-track { flex: 1; width: 24px; background: rgb(var(--v-theme-border)); border-radius: 4px 4px 0 0; position: relative; display: flex; flex-direction: column-reverse; }
.chart-bar-fill { width: 100%; background: rgb(var(--v-theme-primary)); border-radius: 4px 4px 0 0; transition: height 0.3s ease; min-height: 2px; }
.chart-bar-label { height: 18px; line-height: 18px; }

.format-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.format-name { width: 60px; font-size: 13px; font-weight: 500; flex-shrink: 0; }
.format-bar-wrapper { flex: 1; height: 8px; background: rgb(var(--v-theme-border)); border-radius: 4px; overflow: hidden; }
.format-bar { height: 100%; background: rgb(var(--v-theme-primary)); border-radius: 4px; transition: width 0.3s ease; }
.format-count { width: 30px; text-align: right; font-size: 13px; flex-shrink: 0; }
.pagination-bar { display: flex; align-items: center; justify-content: center; padding: 12px 0; border-top: 1px solid rgba(var(--v-theme-on-surface), 0.06); margin-top: 8px; }
.deleted-item { opacity: 0.6; }
</style>
