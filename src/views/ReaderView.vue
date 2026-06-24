<template>
  <div
    class="reader-view"
    :class="`reader-theme-${theme.current}`"
    @keydown="handleKeydown"
    tabindex="0"
    ref="readerRef"
  >
    <!-- Chapter navigation edge zones -->
    <div class="reader-nav-zone reader-nav-zone-left" @click="goPreviousChapter">
      <div class="nav-arrow"><v-icon size="24">mdi-chevron-left</v-icon></div>
    </div>
    <div class="reader-nav-zone reader-nav-zone-right" @click="goNextChapter">
      <div class="nav-arrow"><v-icon size="24">mdi-chevron-right</v-icon></div>
    </div>

    <!-- Top Toolbar (auto-hide) -->
    <v-slide-y-transition>
      <div v-show="reader.showToolbar" class="reader-toolbar" @mouseenter="resetToolbarTimer">
        <v-toolbar density="compact" color="surface" elevation="1">
          <v-tooltip text="返回书架" location="bottom">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-arrow-left" size="small" variant="text" @click="goBack" />
            </template>
          </v-tooltip>

          <v-divider vertical class="mx-1" />

          <v-tooltip text="上一章 (←)" location="bottom">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-chevron-left" size="small" variant="text" :disabled="!reader.hasPreviousChapter" @click="goPreviousChapter" />
            </template>
          </v-tooltip>
          <span class="text-caption mx-1" style="min-width:48px;text-align:center">
            {{ reader.currentChapterIndex + 1 }} / {{ reader.chapterCount }}
          </span>
          <v-tooltip text="下一章 (→)" location="bottom">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-chevron-right" size="small" variant="text" :disabled="!reader.hasNextChapter" @click="goNextChapter" />
            </template>
          </v-tooltip>

          <v-spacer />

          <v-tooltip text="搜索 (Ctrl+F)" location="bottom">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-magnify" size="small" variant="text" :color="reader.showSearch ? 'primary' : ''" @click="toggleSearch" />
            </template>
          </v-tooltip>
          <v-tooltip text="目录" location="bottom">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-book-open-variant" size="small" variant="text" :color="reader.showToc ? 'primary' : ''" @click="reader.showToc = !reader.showToc" />
            </template>
          </v-tooltip>
          <v-tooltip text="书签" location="bottom">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-bookmark" size="small" variant="text" :color="reader.showBookmarks ? 'primary' : ''" @click="reader.showBookmarks = !reader.showBookmarks" />
            </template>
          </v-tooltip>
          <v-tooltip text="标注管理" location="bottom">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-format-color-highlight" size="small" variant="text" :color="reader.showAnnotations ? 'primary' : ''" @click="reader.showAnnotations = !reader.showAnnotations" />
            </template>
          </v-tooltip>

          <v-tooltip text="自动滚屏" location="bottom">
            <template #activator="{ props }">
              <v-btn v-bind="props" :icon="reader.isAutoScrolling ? 'mdi-pause' : 'mdi-play'" size="small" variant="text" :color="reader.isAutoScrolling ? 'primary' : ''" @click="toggleAutoScroll" />
            </template>
          </v-tooltip>

          <v-divider vertical class="mx-1" />

          <v-tooltip text="专注模式" location="bottom">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-image-filter-center-focus" size="small" variant="text" :color="focusMode ? 'primary' : ''" @click="focusMode = !focusMode" />
            </template>
          </v-tooltip>
          <v-tooltip text="阅读统计" location="bottom">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-chart-line" size="small" variant="text" :color="showStatsOverlay ? 'primary' : ''" @click="showStatsOverlay = !showStatsOverlay" />
            </template>
          </v-tooltip>
        </v-toolbar>

        <!-- Search bar -->
        <v-expand-transition>
          <div v-if="reader.showSearch" class="search-bar">
            <v-text-field
              v-model="searchInput"
              placeholder="搜索全文..."
              hide-details
              variant="outlined"
              density="compact"
              prepend-inner-icon="mdi-magnify"
              clearable
              @keyup.enter="performSearch"
              @update:model-value="performSearch"
              autofocus
            >
              <template #append>
                <span v-if="reader.searchResults.length > 0" class="text-caption mr-2">
                  {{ reader.currentSearchIndex + 1 }} / {{ reader.searchResults.length }}
                </span>
                <v-btn
                  v-if="reader.searchResults.length > 0"
                  icon="mdi-chevron-up"
                  size="x-small"
                  variant="text"
                  @click="prevSearchResult"
                />
                <v-btn
                  v-if="reader.searchResults.length > 0"
                  icon="mdi-chevron-down"
                  size="x-small"
                  variant="text"
                  @click="nextSearchResult"
                />
                <v-btn
                  icon="mdi-close"
                  size="x-small"
                  variant="text"
                  @click="reader.clearSearch()"
                />
              </template>
            </v-text-field>
          </div>
        </v-expand-transition>
      </div>
    </v-slide-y-transition>

    <!-- Reading area -->
    <div
      class="reader-container"
      :class="{ 'focus-mode': focusMode }"
      ref="readerContainer"
      @scroll="onScroll"
      @mousemove="resetToolbarTimer"
    >
      <v-progress-linear
        v-if="isChapterLoading"
        indeterminate
        color="primary"
        class="chapter-loading-bar"
      />
      <div class="reader-content-wrapper">
        <!-- Chapter title -->
        <div class="chapter-title" v-if="reader.currentChapter">
          {{ reader.currentChapter.title }}
        </div>

        <!-- Content -->
        <div
          class="reader-content"
          :style="readerStyles"
          v-html="renderedContent"
        />

        <!-- End of chapter navigation -->
        <div class="chapter-end-nav">
          <div v-if="reader.hasPreviousChapter" class="chapter-nav-row">
            <v-btn variant="text" size="small" @click="goPreviousChapter">← 上一章</v-btn>
          </div>
          <div v-if="reader.hasNextChapter" class="chapter-nav-row">
            <v-btn variant="text" color="primary" size="small" @click="goNextChapter">下一章 →</v-btn>
          </div>
          <div v-if="!reader.hasNextChapter" class="chapter-nav-row">
            <span class="text-caption text-medium-emphasis">— 已读完 —</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom controls -->
    <div class="bottom-controls" v-show="reader.showToolbar" @mouseenter="resetToolbarTimer">
      <div class="slider-container">
        <v-slider
          v-model="sliderValue"
          :min="0"
          :max="Math.max(0, reader.chapterCount - 1)"
          :step="1"
          hide-details
          density="compact"
          thumb-label
          show-ticks="always"
          tick-size="2"
          @update:model-value="onSliderChange"
        >
          <template #thumb-label="{ modelValue }">
            {{ modelValue + 1 }}
          </template>
        </v-slider>
        <div class="text-center text-caption mt-1">
          {{ reader.currentChapter?.title || '' }}
        </div>
      </div>
    </div>

    <!-- Selection menu -->
    <div
      v-if="selectionMenu.visible"
      class="selection-menu"
      :style="{ top: selectionMenu.y + 'px', left: selectionMenu.x + 'px' }"
      @mousedown.prevent
    >
      <button
        v-for="c in highlightColors"
        :key="c.value"
        class="selection-btn"
        :title="c.label"
        :style="{ '--sel-color': c.hex, '--sel-bg': c.bg }"
        @click="highlightSelection(c.value)"
      >
        <v-icon size="14" :color="c.hex">mdi-format-color-text</v-icon>
      </button>
      <div class="selection-divider" />
      <button class="selection-btn" title="笔记" @click="addNoteSelection">
        <v-icon size="14">mdi-note-edit</v-icon>
        <span class="selection-label">笔记</span>
      </button>
      <button class="selection-btn" title="复制" @click="copySelection">
        <v-icon size="14">mdi-content-copy</v-icon>
        <span class="selection-label">复制</span>
      </button>
      <button class="selection-btn" title="查词典" @click="lookupSelection">
        <v-icon size="14">mdi-book-search</v-icon>
        <span class="selection-label">查词</span>
      </button>
    </div>

    <!-- Note dialog -->
    <v-dialog v-model="showNoteDialog" max-width="450">
      <v-card>
        <v-card-title>添加笔记</v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-2 text-medium-emphasis selected-preview">{{ selectedText }}</p>
          <v-textarea
            v-model="noteContent"
            label="笔记内容"
            rows="3"
            variant="outlined"
            hide-details
            autofocus
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showNoteDialog = false">取消</v-btn>
          <v-btn color="primary" @click="saveNote">保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Edit annotation dialog -->
    <v-dialog v-model="showEditAnnotation" max-width="450">
      <v-card v-if="editingAnnotation">
        <v-card-title>编辑标注</v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-2 text-medium-emphasis selected-preview">{{ editingAnnotation.text }}</p>
          <v-textarea
            v-model="editNoteContent"
            label="笔记内容"
            rows="3"
            variant="outlined"
            hide-details
            autofocus
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showEditAnnotation = false">取消</v-btn>
          <v-btn color="primary" @click="saveEditAnnotation">保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- TOC drawer (right side) -->
    <v-navigation-drawer
      v-model="reader.showToc"
      location="right"
      temporary
      width="320"
    >
      <v-toolbar density="compact" color="surface">
        <v-toolbar-title>目录</v-toolbar-title>
        <v-spacer />
        <v-btn icon="mdi-close" size="small" variant="text" @click="reader.showToc = false" />
      </v-toolbar>
      <v-list density="compact" nav>
        <v-list-item
          v-for="(chapter, idx) in reader.chapters"
          :key="idx"
          :title="chapter.title"
          :active="idx === reader.currentChapterIndex"
          @click="goToChapterFromToc(idx)"
        >
          <template #append>
            <v-icon
              v-if="readChaptersSet.has(reader.bookId + ':' + idx)"
              size="16"
              color="green"
            >mdi-check-circle</v-icon>
          </template>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <!-- Bookmarks drawer (right side) -->
    <v-navigation-drawer
      v-model="reader.showBookmarks"
      location="right"
      temporary
      width="320"
    >
      <v-toolbar density="compact" color="surface">
        <v-toolbar-title>书签</v-toolbar-title>
        <v-spacer />
        <v-btn
          color="primary"
          size="small"
          variant="text"
          prepend-icon="mdi-plus"
          @click="addBookmarkHere"
        >
          添加书签
        </v-btn>
        <v-btn icon="mdi-close" size="small" variant="text" @click="reader.showBookmarks = false" />
      </v-toolbar>
      <v-list density="compact" nav>
        <v-list-item
          v-for="bm in reader.bookmarks"
          :key="bm.id"
          :title="bm.name"
          :subtitle="getChapterTitle(bm.chapterIndex)"
          @click="reader.navigateToChapter(bm.chapterIndex); reader.showBookmarks = false"
        >
          <template #append>
            <v-btn
              icon="mdi-delete"
              size="x-small"
              variant="text"
              @click.stop="reader.removeBookmark(bm.id)"
            />
          </template>
        </v-list-item>
        <v-list-item
          v-if="reader.bookmarks.length === 0"
          title="暂无书签"
          subtitle="点击上方按钮添加"
          disabled
        />
      </v-list>
    </v-navigation-drawer>

    <!-- Annotations drawer (right side) -->
    <v-navigation-drawer
      v-model="reader.showAnnotations"
      location="right"
      temporary
      width="360"
    >
      <v-toolbar density="compact" color="surface">
        <v-toolbar-title>标注</v-toolbar-title>
        <v-spacer />
        <v-btn icon="mdi-close" size="small" variant="text" @click="reader.showAnnotations = false" />
      </v-toolbar>
      <v-list density="compact" nav>
        <v-list-item
          v-for="ann in reader.currentChapterAnnotations"
          :key="ann.id"
          :title="ann.text"
          :subtitle="ann.note || '无笔记'"
        >
          <template #prepend>
            <div
              class="annotation-color-dot"
              :style="{ backgroundColor: getHighlightHex(ann.color) }"
            />
          </template>
          <template #append>
            <v-btn
              icon="mdi-pencil"
              size="x-small"
              variant="text"
              @click.stop="editAnnotation(ann)"
            />
            <v-btn
              icon="mdi-delete"
              size="x-small"
              variant="text"
              @click.stop="reader.deleteAnnotation(ann.id)"
            />
          </template>
        </v-list-item>
        <v-list-item
          v-if="reader.currentChapterAnnotations.length === 0"
          title="当前章节无标注"
          subtitle="选中文字后可以添加高亮或笔记"
          disabled
        />
      </v-list>
    </v-navigation-drawer>

    <!-- Auto-scroll indicator -->
    <div v-if="reader.isAutoScrolling" class="auto-scroll-indicator">
      <v-icon size="16" class="mr-1">mdi-play</v-icon>
      自动滚屏
      <v-btn
        icon="mdi-close"
        size="x-small"
        variant="text"
        color="white"
        class="ml-2"
        @click="toggleAutoScroll"
      />
    </div>

    <!-- Reading stats overlay (bottom-right) -->
    <div v-if="showStatsOverlay" class="reading-stats-overlay">
      <div class="stats-header">
        <span>📊 阅读统计</span>
        <v-btn icon="mdi-close" size="x-small" variant="text" density="compact" color="white" @click="showStatsOverlay = false" />
      </div>
      <div class="stats-body">
        <div class="stats-row">
          <span class="stats-label">阅读速度</span>
          <span class="stats-value">{{ readingSpeedPerMin ? readingSpeedPerMin + ' 字/分钟' : '计算中...' }}</span>
        </div>
        <div class="stats-row">
          <span class="stats-label">本章剩余</span>
          <span class="stats-value">{{ chapterFinishTime || '计算中...' }}</span>
        </div>
        <div class="stats-row">
          <span class="stats-label">全书进度</span>
          <span class="stats-value">{{ bookProgressPct }}%</span>
        </div>
      </div>
    </div>

    <!-- Dictionary lookup dialog -->
    <v-dialog v-model="showDictResult" max-width="450">
      <v-card>
        <v-card-title class="d-flex align-center">
          词典: {{ dictWord }}
          <v-spacer />
        </v-card-title>
        <v-card-text>
          <div v-if="dictLoading" class="text-center pa-4">
            <v-progress-circular indeterminate />
            <p class="text-caption mt-2">查询中...</p>
          </div>
          <div v-else-if="dictResult && dictResult.meanings">
            <div v-for="(meaning, idx) in dictResult.meanings" :key="idx" class="mb-3">
              <v-chip size="x-small" color="primary" class="mb-1">{{ meaning.partOfSpeech }}</v-chip>
              <ul class="definition-list">
                <li v-for="(def, dIdx) in meaning.definitions" :key="dIdx" class="mb-1">
                  {{ def.definition }}
                  <span v-if="def.example" class="text-caption text-medium-emphasis">
                    <br />示例: "{{ def.example }}"
                  </span>
                </li>
              </ul>
            </div>
          </div>
          <div v-else-if="dictError" class="text-error">
            {{ dictError }}
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useReaderStore } from '@/stores/reader'
import { useSettingsStore } from '@/stores/settings'
import { useBookshelfStore } from '@/stores/bookshelf'
import { useThemeStore } from '@/stores/theme'
import { HIGHLIGHT_COLORS } from '@/constants'
import { db } from '@/services/db'
import type { Annotation, HighlightColor } from '@/types'

const router = useRouter()
const route = useRoute()
const reader = useReaderStore()
const settings = useSettingsStore()
const bookshelf = useBookshelfStore()
const theme = useThemeStore()

const readerRef = ref<HTMLElement | null>(null)
const readerContainer = ref<HTMLElement | null>(null)
const searchInput = ref('')
const sliderValue = ref(0)
const showNoteDialog = ref(false)
const showEditAnnotation = ref(false)
const showDictResult = ref(false)
const noteContent = ref('')
const editNoteContent = ref('')
const selectedText = ref('')
const selectedOffset = ref({ start: 0, end: 0 })
const editingAnnotation = ref<Annotation | null>(null)
const dictWord = ref('')
const dictResult = ref<any>(null)
const dictLoading = ref(false)
const dictError = ref('')
const isChapterLoading = ref(false)
const focusMode = ref(false)
const showStatsOverlay = ref(false)

const highlightColors = HIGHLIGHT_COLORS

let toolbarTimer: ReturnType<typeof setTimeout> | null = null
let autoScrollTimer: ReturnType<typeof setInterval> | null = null
let readingTimeInterval: ReturnType<typeof setInterval> | null = null
const readingSeconds = ref(0)
let isChapterTransition = false
let isNavigatingBack = false

const readingProgress = ref(0)
let autoSaveTimer: ReturnType<typeof setInterval> | null = null
let customCssStyleEl: HTMLStyleElement | null = null

const formattedReadingTime = computed(() => {
  const h = Math.floor(readingSeconds.value / 3600)
  const m = Math.floor((readingSeconds.value % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
})

const currentBook = computed(() => bookshelf.books.find(b => b.id === reader.bookId))

const totalBookReadingSeconds = computed(() => {
  return (currentBook.value?.totalReadingTime || 0) + readingSeconds.value
})

const formattedTotalReadingTime = computed(() => {
  const total = totalBookReadingSeconds.value
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (h > 0) return `${h}小时${m}分钟`
  return `${m}分钟`
})

const estimatedRemaining = computed(() => {
  const book = currentBook.value
  if (!book || !book.wordCount || totalBookReadingSeconds.value < 30) return ''
  const totalWords = book.wordCount
  const overallProgress = book.progress || 0
  const wordsRead = Math.max(1, Math.floor(totalWords * overallProgress))
  const speed = wordsRead / Math.max(1, totalBookReadingSeconds.value)
  const remainingWords = totalWords - wordsRead
  if (remainingWords <= 0 || speed <= 0.001) return ''
  const remainingSeconds = remainingWords / speed
  if (remainingSeconds < 60) return '不到1分钟'
  const h = Math.floor(remainingSeconds / 3600)
  const m = Math.floor((remainingSeconds % 3600) / 60)
  if (h > 0) return `约${h}时${m}分`
  return `约${m}分钟`
})

// ---- Reading stats overlay ----
const readingSpeedPerMin = computed(() => {
  const book = currentBook.value
  if (!book || !book.wordCount || totalBookReadingSeconds.value < 5) return null
  const totalWords = book.wordCount
  const overallProgress = book.progress || 0
  const wordsRead = Math.max(1, Math.floor(totalWords * overallProgress))
  const minutes = Math.max(1, totalBookReadingSeconds.value / 60)
  return Math.round(wordsRead / minutes)
})

const chapterFinishTime = computed(() => {
  const speed = readingSpeedPerMin.value
  if (!speed || !reader.currentChapter) return null
  // Count words in current chapter
  const chapterHtml = reader.currentChapter.content || ''
  const textContent = chapterHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const chapterWords = textContent.length > 0 ? textContent.split(/\s+/).length : 0
  if (chapterWords === 0) return null
  // Estimate how far through the chapter
  const containerEl = readerContainer.value
  let chapterProgress = 0
  if (containerEl) {
    const scrollH = containerEl.scrollHeight - containerEl.clientHeight
    chapterProgress = scrollH > 0 ? containerEl.scrollTop / scrollH : 0
  }
  const remainingWords = Math.round(chapterWords * (1 - chapterProgress))
  if (remainingWords <= 0) return '即将读完'
  const remainingMinutes = remainingWords / speed
  if (remainingMinutes < 1) return '< 1分钟'
  if (remainingMinutes < 60) return `约${Math.round(remainingMinutes)}分钟`
  const h = Math.floor(remainingMinutes / 60)
  const m = Math.round(remainingMinutes % 60)
  return `约${h}时${m}分`
})

const bookProgressPct = computed(() => {
  const book = currentBook.value
  if (!book) return 0
  return Math.round((book.progress || 0) * 100)
})

const selectionMenu = ref({
  visible: false,
  x: 0,
  y: 0
})

const readerStyles = computed(() => ({
  '--font-s': settings.readingSettings.fontSize + 'px',
  '--line-h': settings.readingSettings.lineHeight,
  '--para-sp': settings.readingSettings.paragraphSpacing + 'px',
  '--text-ident': settings.readingSettings.textIndent + 'em',
  '--font-w': settings.readingSettings.fontWeight,
  '--font-f': settings.readingSettings.fontFamily,
  '--margin-h': settings.readingSettings.marginHorizontal + 'px',
  '--page-w': settings.readingSettings.pageWidth + 'px',
  '--bg-img': settings.readingSettings.bgImageUrl ? `url(${settings.readingSettings.bgImageUrl})` : 'none',
  '--bg-opacity': settings.readingSettings.bgOpacity,
  '--bg-color': settings.themeColors.bgColor,
  '--text-color': settings.themeColors.textColor,
}))

// Strip the leading heading from content if it duplicates the chapter title
function stripLeadingTitle(html: string, title: string): string {
  if (!html || !title) return html
  const cleanTitle = title.trim()
  const regex = /<h([12])(?:\s[^>]*)?>(.*?)<\/h\1>/is
  const match = regex.exec(html)
  if (!match) return html
  const innerText = match[2].replace(/<[^>]+>/g, '').trim()
  if (innerText === cleanTitle) {
    return html.substring(0, match.index) + html.substring(match.index + match[0].length)
  }
  return html
}

const renderedContent = computed(() => {
  const chapter = reader.currentChapter
  if (!chapter) return ''
  return stripLeadingTitle(chapter.content, chapter.title)
})

// ---- Helpers ----

function getHighlightHex(color: HighlightColor): string {
  const found = HIGHLIGHT_COLORS.find(c => c.value === color)
  return found?.hex || '#F9A825'
}

function getChapterTitle(index: number): string {
  return reader.chapters[index]?.title || `第 ${index + 1} 章`
}

function restoreScrollPosition(chapterIndex: number) {
  nextTick(() => {
    if (readerContainer.value) {
      const saved = reader.getScrollPosition(chapterIndex)
      readerContainer.value.scrollTop = saved
    }
  })
}

function saveScrollNow() {
  if (readerContainer.value) {
    reader.saveScrollPosition(reader.currentChapterIndex, readerContainer.value.scrollTop)
  }
}

function markChapterRead(bookId: string, chapterIndex: number) {
  const key = `${bookId}:${chapterIndex}`
  const s = new Set(bookshelf.readChapters)
  s.add(key)
  bookshelf.readChapters = s
  // Persist to DB
  persistReadChapters(bookId)
}

async function loadPersistedReadChapters(bookId: string) {
  try {
    const rec = await db.cfg.get(`readChapters:${bookId}`)
    if (rec) {
      const arr: string[] = JSON.parse(rec.v)
      bookshelf.readChapters = new Set(arr)
    } else {
      bookshelf.readChapters = new Set()
    }
  } catch { bookshelf.readChapters = new Set() }
}

async function persistReadChapters(bookId: string) {
  try {
    const arr = Array.from(bookshelf.readChapters)
    await db.cfg.put({ k: `readChapters:${bookId}`, v: JSON.stringify(arr) })
  } catch { /* ignore */ }
}

async function loadPersistedScrollPositions(bookId: string) {
  try {
    const rec = await db.cfg.get(`scroll:${bookId}`)
    if (rec) {
      const data: Record<number, number> = JSON.parse(rec.v)
      // Populate reader's in-memory scroll positions
      for (const [key, val] of Object.entries(data)) {
        reader.saveScrollPosition(Number(key), val)
      }
    }
  } catch { /* ignore */ }
}

async function persistScrollPositions(bookId: string) {
  try {
    // Collect current in-memory scroll positions
    const data: Record<number, number> = {}
    // Also save current chapter's scroll position
    if (readerContainer.value) {
      reader.saveScrollPosition(reader.currentChapterIndex, readerContainer.value.scrollTop)
    }
    // Use reader's scrollPosition ref
    for (const [key, val] of Object.entries(reader.scrollPosition)) {
      data[Number(key)] = val
    }
    await db.cfg.put({ k: `scroll:${bookId}`, v: JSON.stringify(data) })
  } catch { /* ignore */ }
}

const readChaptersSet = computed(() => bookshelf.readChapters)

function highlightAnnotationInDom(text: string) {
  if (!readerContainer.value) return
  const walker = document.createTreeWalker(readerContainer.value, NodeFilter.SHOW_TEXT)
  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    const idx = node.textContent?.indexOf(text)
    if (idx !== undefined && idx >= 0) {
      const range = document.createRange()
      range.setStart(node, idx)
      range.setEnd(node, idx + text.length)
      const rect = range.getBoundingClientRect()
      readerContainer.value.scrollTop = rect.top + readerContainer.value.scrollTop - readerContainer.value.clientHeight / 2

      // Highlight with red
      const span = document.createElement('span')
      span.style.backgroundColor = 'rgba(255,0,0,0.4)'
      span.style.borderRadius = '2px'
      range.surroundContents(span)
      break
    }
  }
}

function applyChapterAnnotations() {
  if (!readerContainer.value) return
  const anns = reader.currentChapterAnnotations
  anns.forEach(ann => {
    if (ann.type !== 'highlight') return
    const colorCfg = HIGHLIGHT_COLORS.find(c => c.value === ann.color)
    const bg = colorCfg?.bg || 'rgba(255,235,59,0.35)'
    const walker = document.createTreeWalker(readerContainer.value!, NodeFilter.SHOW_TEXT)
    let node: Text | null
    while ((node = walker.nextNode() as Text | null)) {
      const idx = (node.textContent || '').indexOf(ann.text)
      if (idx >= 0) {
        try {
          const r = document.createRange()
          r.setStart(node, idx)
          r.setEnd(node, idx + ann.text.length)
          const span = document.createElement('span')
          span.style.backgroundColor = bg
          span.style.borderRadius = '2px'
          r.surroundContents(span)
        } catch {}
        break
      }
    }
  })
}

// ---- Book loading & position restore ----

async function loadBook() {
  const id = route.params.id as string

  // Look up the book to get saved chapterIndex
  const book = bookshelf.books.find(b => b.id === id)

  await reader.loadBook(id)

  // Load persisted scroll positions and read chapters AFTER loadBook (which resets scrollPosition)
  await loadPersistedScrollPositions(id)
  await loadPersistedReadChapters(id)

  // Restore chapter index from book data
  if (book && book.chapterIndex >= 0 && book.chapterIndex < reader.chapterCount) {
    reader.currentChapterIndex = book.chapterIndex
  } else {
    reader.currentChapterIndex = 0
  }

  sliderValue.value = reader.currentChapterIndex

  // Restore scroll position for the saved chapter
  await nextTick()
  if (readerContainer.value) {
    // Check if coming from annotation jump (query params ci + aid)
    const ciParam = route.query.ci
    const aidParam = route.query.aid
    if (ciParam !== undefined) {
      const targetCi = parseInt(ciParam as string)
      if (targetCi >= 0 && targetCi < reader.chapterCount) {
        reader.currentChapterIndex = targetCi
        sliderValue.value = targetCi
        await nextTick()
      }
    }
    if (aidParam) {
      // Find annotation and highlight it
      await nextTick()
      const annRecord = await db.ann.get(aidParam as string)
      if (annRecord) {
        const ann: Annotation = JSON.parse(annRecord.data)
        if (ann && ann.text) {
          // Search for annotation text in the DOM and scroll+highlight
          await nextTick()
          highlightAnnotationInDom(ann.text)
        }
      }
    }
    const saved = reader.getScrollPosition(reader.currentChapterIndex)
    readerContainer.value.scrollTop = saved
  }

  // Start reading time tracking
  startReadingTimer()
}

// ---- Navigation ----

async function goBack() {
  // Save current position before exiting
  isNavigatingBack = true
  saveScrollNow()
  const scrollHeight = readerContainer.value
    ? readerContainer.value.scrollHeight - readerContainer.value.clientHeight
    : 1
  const progress = scrollHeight > 0
    ? (readerContainer.value?.scrollTop || 0) / scrollHeight
    : 0

  // Persist all scroll positions and read chapters to DB
  await persistScrollPositions(reader.bookId)
  await persistReadChapters(reader.bookId)

  // Await the DB save before navigating to prevent progress reset
  await bookshelf.updateBookProgress(reader.bookId, reader.currentChapterIndex, progress)

  // Mark current chapter as read
  markChapterRead(reader.bookId, reader.currentChapterIndex)

  // Stop timers
  stopAutoScrollTimer()
  stopReadingTimer()
  if (readingSeconds.value > 0) {
    await bookshelf.updateBookReadingTime(reader.bookId, readingSeconds.value)
    readingSeconds.value = 0
  }

  router.push({ name: 'bookshelf' })
}

function goNextChapter() {
  if (!reader.hasNextChapter) return
  saveScrollNow()
  isChapterTransition = true
  isChapterLoading.value = true

  // Mark current chapter as read
  markChapterRead(reader.bookId, reader.currentChapterIndex)

  reader.nextChapter()
  sliderValue.value = reader.currentChapterIndex

  // Restore saved position for target chapter (watcher will handle via restoreScrollPosition)
  // Persist scroll positions when switching chapters
  persistScrollPositions(reader.bookId)
}

function goPreviousChapter() {
  if (!reader.hasPreviousChapter) return
  saveScrollNow()
  isChapterTransition = true
  isChapterLoading.value = true
  reader.previousChapter()
  sliderValue.value = reader.currentChapterIndex

  // Persist scroll positions when switching chapters
  persistScrollPositions(reader.bookId)

  // Restore saved position for previous chapter
  nextTick(() => {
    if (readerContainer.value) {
      const saved = reader.getScrollPosition(reader.currentChapterIndex)
      readerContainer.value.scrollTop = saved
    }
  })
}

function onSliderChange(val: number) {
  if (val === reader.currentChapterIndex) return
  saveScrollNow()
  isChapterTransition = true
  isChapterLoading.value = true
  persistScrollPositions(reader.bookId)
  reader.navigateToChapter(val)
}

function goToChapterFromToc(idx: number) {
  if (idx === reader.currentChapterIndex) {
    reader.showToc = false
    return
  }
  // Mark current chapter as read before navigating
  markChapterRead(reader.bookId, reader.currentChapterIndex)
  saveScrollNow()
  isChapterTransition = true
  isChapterLoading.value = true
  persistScrollPositions(reader.bookId)
  reader.navigateToChapter(idx)
  reader.showToc = false
}

// ---- Scroll ----

function onScroll() {
  if (isChapterTransition) return
  if (readerContainer.value) {
    reader.saveScrollPosition(reader.currentChapterIndex, readerContainer.value.scrollTop)

    // Save reading progress
    const scrollHeight = readerContainer.value.scrollHeight - readerContainer.value.clientHeight
    const progress = scrollHeight > 0 ? readerContainer.value.scrollTop / scrollHeight : 0
    readingProgress.value = Math.round(progress * 100)
    bookshelf.updateBookProgress(reader.bookId, reader.currentChapterIndex, progress)

    // Mark chapter as read when scrolled past 80%
    if (progress >= 0.8) {
      markChapterRead(reader.bookId, reader.currentChapterIndex)
    }

    // Update focus mode paragraph
    if (focusMode.value) {
      updateFocusParagraph()
    }
  }
}

function updateFocusParagraph() {
  if (!readerContainer.value || !focusMode.value) return
  const container = readerContainer.value
  const paras = container.querySelectorAll('.reader-content p')
  if (paras.length === 0) return

  const viewportCenter = container.getBoundingClientRect().top + container.clientHeight / 2
  let closestPara: HTMLParagraphElement | null = null
  let closestDist = Infinity

  paras.forEach(p => {
    const rect = p.getBoundingClientRect()
    const paraCenter = rect.top + rect.height / 2
    const dist = Math.abs(paraCenter - viewportCenter)
    if (dist < closestDist) {
      closestDist = dist
      closestPara = p as HTMLParagraphElement
    }
  })

  // Remove active class from all, add to closest
  paras.forEach(p => p.classList.remove('focus-active'))
  if (closestPara) {
    closestPara.classList.add('focus-active')
    // Mark nearby paragraphs for progressive dimming
    let prev = closestPara.previousElementSibling as HTMLElement | null
    let next = closestPara.nextElementSibling as HTMLElement | null
    for (let i = 1; i <= 3; i++) {
      if (prev && prev.tagName === 'P') {
        prev.style.setProperty('--focus-dist', String(i))
        prev = prev.previousElementSibling as HTMLElement | null
      }
      if (next && next.tagName === 'P') {
        next.style.setProperty('--focus-dist', String(i))
        next = next.nextElementSibling as HTMLElement | null
      }
    }
  }
}

// Watch chapter index changes to restore scroll
watch(() => reader.currentChapterIndex, (newIdx) => {
  if (!isChapterTransition) return
  isChapterTransition = false
  sliderValue.value = newIdx
  restoreScrollPosition(newIdx)
  // Apply annotation highlights to DOM
  nextTick(() => {
    applyChapterAnnotations()
    isChapterLoading.value = false
    if (focusMode.value) updateFocusParagraph()
  })
})

// Watch for custom CSS changes
watch(() => settings.readingSettings.customCSS, () => {
  injectCustomCSS()
})

// Watch for auto-save interval changes
watch(() => settings.readingSettings.autoSaveInterval, () => {
  startAutoSave()
})

// Watch for focus mode toggle
watch(focusMode, (val) => {
  if (val) {
    nextTick(() => updateFocusParagraph())
  } else {
    // Remove all focus classes
    if (readerContainer.value) {
      readerContainer.value.querySelectorAll('.reader-content .focus-active').forEach(el => el.classList.remove('focus-active'))
      readerContainer.value.querySelectorAll('.reader-content p').forEach(el => {
        (el as HTMLElement).style.removeProperty('--focus-dist')
      })
    }
  }
})

// ---- Keyboard ----

/** Convert a KeyboardEvent to the same shortcut string format used in settings */
function eventToShortcut(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Meta')
  const keyMap: Record<string, string> = {
    'ArrowUp': 'Up', 'ArrowDown': 'Down', 'ArrowLeft': 'Left', 'ArrowRight': 'Right',
    'PageUp': 'PageUp', 'PageDown': 'PageDown', 'Home': 'Home', 'End': 'End',
    ' ': 'Space', 'Escape': 'Esc', 'Tab': 'Tab',
    'Delete': 'Del', 'Insert': 'Ins', 'Backspace': 'Backspace', 'Enter': 'Enter'
  }
  const keyName = keyMap[e.key] || (e.key.length === 1 ? e.key.toUpperCase() : e.key)
  parts.push(keyName)
  return parts.join('+')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

  const sc = settings.readingShortcuts
  const shortcut = eventToShortcut(e)

  // Built-in hardcoded shortcuts (Left/Right for chapter nav, Ctrl+F for search, Home/End)
  if (shortcut === 'Left') {
    e.preventDefault()
    if (!isChapterTransition) goPreviousChapter()
  } else if (shortcut === 'Right') {
    e.preventDefault()
    if (!isChapterTransition) goNextChapter()
  } else if (shortcut === 'Ctrl+F') {
    e.preventDefault()
    toggleSearch()
  } else if (shortcut === 'Home') {
    e.preventDefault()
    if (readerContainer.value) {
      readerContainer.value.scrollTo({ top: 0, behavior: 'smooth' })
    }
  } else if (shortcut === 'End') {
    e.preventDefault()
    if (readerContainer.value) {
      readerContainer.value.scrollTo({ top: readerContainer.value.scrollHeight, behavior: 'smooth' })
    }
  } else if (shortcut === sc.scrollUp) {
    e.preventDefault()
    if (readerContainer.value) {
      readerContainer.value.scrollBy({ top: -24, behavior: 'smooth' })
    }
  } else if (shortcut === sc.scrollDown) {
    e.preventDefault()
    if (readerContainer.value) {
      readerContainer.value.scrollBy({ top: 24, behavior: 'smooth' })
    }
  } else if (shortcut === sc.pageUp) {
    e.preventDefault()
    if (readerContainer.value) {
      readerContainer.value.scrollBy({ top: -readerContainer.value.clientHeight * 0.9, behavior: 'smooth' })
    }
  } else if (shortcut === sc.pageDown || shortcut === 'Space') {
    e.preventDefault()
    if (readerContainer.value) {
      readerContainer.value.scrollBy({ top: readerContainer.value.clientHeight * 0.9, behavior: 'smooth' })
    }
  }
}

// ---- Search ----

function toggleSearch() {
  reader.showSearch = !reader.showSearch
  if (reader.showSearch) {
    nextTick(() => { searchInput.value = '' })
  } else {
    reader.clearSearch()
    searchInput.value = ''
  }
}

function performSearch() {
  reader.performSearch(searchInput.value)
}

function prevSearchResult() {
  if (reader.searchResults.length === 0) return
  reader.currentSearchIndex = reader.currentSearchIndex > 0
    ? reader.currentSearchIndex - 1
    : reader.searchResults.length - 1
}

function nextSearchResult() {
  if (reader.searchResults.length === 0) return
  reader.currentSearchIndex = reader.currentSearchIndex < reader.searchResults.length - 1
    ? reader.currentSearchIndex + 1
    : 0
}

// ---- Selection handling ----

function handleSelection() {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !selection.rangeCount) {
    selectionMenu.value.visible = false
    return
  }

  const text = selection.toString().trim()
  if (!text) {
    selectionMenu.value.visible = false
    return
  }

  selectedText.value = text

  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()

  // Position the menu above the selection
  const menuWidth = 280
  let left = rect.left + rect.width / 2 - menuWidth / 2
  left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8))

  let top = rect.top - 44
  if (top < 8) top = rect.bottom + 8

  selectionMenu.value = {
    visible: true,
    x: left,
    y: top
  }

  // Compute rough offsets within the chapter's stripped content
  const content = reader.currentChapter?.content || ''
  const stripped = content.replace(/<[^>]+>/g, ' ')
  const startIdx = stripped.indexOf(text)
  selectedOffset.value = {
    start: startIdx >= 0 ? startIdx : 0,
    end: startIdx >= 0 ? startIdx + text.length : text.length
  }
}

function highlightSelection(color: HighlightColor) {
  // Save to DB
  reader.addHighlight(
    selectedOffset.value.start,
    selectedOffset.value.end,
    selectedText.value,
    color
  )

  // Apply to DOM immediately
  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0)
    const span = document.createElement('span')
    span.className = `hl-${color}`
    try { range.surroundContents(span) } catch {}
  }
  dismissSelection()
}

function addNoteSelection() {
  showNoteDialog.value = true
  selectionMenu.value.visible = false
  noteContent.value = ''
}

async function saveNote() {
  await reader.addNote(
    selectedOffset.value.start,
    selectedOffset.value.end,
    selectedText.value,
    noteContent.value
  )
  showNoteDialog.value = false
  dismissSelection()
}

function copySelection() {
  navigator.clipboard.writeText(selectedText.value).catch(console.error)
  dismissSelection()
}

function lookupSelection() {
  selectionMenu.value.visible = false
  lookupWord(selectedText.value.trim())
  dismissSelection()
}

function dismissSelection() {
  selectionMenu.value.visible = false
  window.getSelection()?.removeAllRanges()
}

async function lookupWord(word: string) {
  dictWord.value = word
  showDictResult.value = true
  dictLoading.value = true
  dictError.value = ''

  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
    if (!response.ok) throw new Error('未找到释义')
    const data = await response.json()
    dictResult.value = data[0]
  } catch (e: any) {
    dictError.value = '查询失败: ' + (e.message || '网络错误')
    dictResult.value = null
  } finally {
    dictLoading.value = false
  }
}

// ---- Auto-scroll ----

function toggleAutoScroll() {
  reader.isAutoScrolling = !reader.isAutoScrolling
  if (reader.isAutoScrolling) {
    startAutoScroll()
  } else {
    stopAutoScrollTimer()
  }
}

function startAutoScroll() {
  const speed = settings.autoScrollSpeed || 50
  const intervalMs = Math.max(10, 110 - speed)
  autoScrollTimer = setInterval(() => {
    if (readerContainer.value) {
      readerContainer.value.scrollTop += 1
      const { scrollTop, scrollHeight, clientHeight } = readerContainer.value
      if (scrollTop + clientHeight >= scrollHeight - 2) {
        if (reader.hasNextChapter) {
          goNextChapter()
        } else {
          reader.isAutoScrolling = false
          stopAutoScrollTimer()
        }
      }
    }
  }, intervalMs)
}

function stopAutoScrollTimer() {
  if (autoScrollTimer) {
    clearInterval(autoScrollTimer)
    autoScrollTimer = null
  }
}

// ---- Bookmarks ----

async function addBookmarkHere() {
  const chapter = reader.currentChapter
  if (!chapter) return
  const name = chapter.title || `第 ${reader.currentChapterIndex + 1} 章`
  const offset = readerContainer.value?.scrollTop || 0
  await reader.addBookmark(name, offset)
}

// ---- Annotations ----

function editAnnotation(ann: Annotation) {
  editingAnnotation.value = ann
  editNoteContent.value = ann.note
  showEditAnnotation.value = true
}

async function saveEditAnnotation() {
  if (editingAnnotation.value) {
    await reader.updateAnnotationNote(editingAnnotation.value.id, editNoteContent.value)
  }
  showEditAnnotation.value = false
}

// ---- Toolbar auto-hide ----

function resetToolbarTimer() {
  reader.showToolbar = true
  if (toolbarTimer) clearTimeout(toolbarTimer)
  const delay = (settings.toolbarAutoHideDelay || 4) * 1000
  if (delay > 0) {
    toolbarTimer = setTimeout(() => {
      if (!reader.showSearch) {
        reader.showToolbar = false
      }
    }, delay)
  }
}

// ---- Reading time ----

function startReadingTimer() {
  readingSeconds.value = 0
  if (readingTimeInterval) clearInterval(readingTimeInterval)
  readingTimeInterval = setInterval(() => {
    readingSeconds.value++
    if (readingSeconds.value % 30 === 0) {
      bookshelf.updateBookReadingTime(reader.bookId, 30)
    }
  }, 1000)
}

function stopReadingTimer() {
  if (readingTimeInterval) {
    clearInterval(readingTimeInterval)
    readingTimeInterval = null
  }
}

// ---- Custom CSS injection ----

function injectCustomCSS() {
  if (!readerContainer.value) return
  const css = settings.readingSettings.customCSS
  if (css) {
    if (!customCssStyleEl) {
      customCssStyleEl = document.createElement('style')
      customCssStyleEl.id = 'reader-custom-css'
      readerContainer.value.appendChild(customCssStyleEl)
    }
    customCssStyleEl.textContent = css
  } else {
    removeCustomCSS()
  }
}

function removeCustomCSS() {
  if (customCssStyleEl) {
    customCssStyleEl.remove()
    customCssStyleEl = null
  }
}

// ---- Auto-save interval ----

function startAutoSave() {
  stopAutoSave()
  const interval = Math.max(5, settings.readingSettings.autoSaveInterval || 10)
  autoSaveTimer = setInterval(() => {
    saveScrollNow()
    persistScrollPositions(reader.bookId)
  }, interval * 1000)
}

function stopAutoSave() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer)
    autoSaveTimer = null
  }
}

// ---- Ctrl+wheel font resize ----

function onWheel(e: WheelEvent) {
  if (e.ctrlKey) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -1 : 1
    const newSize = Math.max(12, Math.min(32, settings.readingSettings.fontSize + delta))
    settings.updateReadingSetting('fontSize', newSize)
  }
}

// ---- Lifecycle ----

onMounted(async () => {
  await loadBook()
  document.addEventListener('mouseup', handleSelection)
  document.addEventListener('wheel', onWheel, { passive: false })
  resetToolbarTimer()

  // Focus the reader for keyboard events
  readerRef.value?.focus()

  // Custom CSS and auto-save — use nextTick to ensure readerContainer ref is available
  await nextTick()
  injectCustomCSS()
  startAutoSave()
})

onUnmounted(() => {
  // Only save if not already saved via goBack (which awaits the DB write)
  if (!isNavigatingBack) {
    saveScrollNow()
    const scrollHeight = readerContainer.value
      ? readerContainer.value.scrollHeight - readerContainer.value.clientHeight
      : 1
    const progress = scrollHeight > 0
      ? (readerContainer.value?.scrollTop || 0) / scrollHeight
      : 0
    // Await these DB operations to prevent data loss on unmount
    Promise.allSettled([
      bookshelf.updateBookProgress(reader.bookId, reader.currentChapterIndex, progress),
      persistScrollPositions(reader.bookId),
      persistReadChapters(reader.bookId)
    ])
  }

  // Clean up timers
  if (toolbarTimer) clearTimeout(toolbarTimer)
  stopAutoScrollTimer()
  stopReadingTimer()
  stopAutoSave()
  removeCustomCSS()
  if (readingSeconds.value > 0) {
    bookshelf.updateBookReadingTime(reader.bookId, readingSeconds.value)
  }

  // Clean up listeners
  document.removeEventListener('mouseup', handleSelection)
  document.removeEventListener('wheel', onWheel)
})
</script>

<style scoped>
/* ---- Layout ---- */
.reader-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  outline: none;
  background: rgb(var(--v-theme-background));
}

/* ---- Navigation edge zones ---- */
.reader-nav-zone {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 60px;
  z-index: 5;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.reader-nav-zone:hover {
  opacity: 1;
  background: rgba(var(--v-theme-on-surface), 0.03);
}
.reader-nav-zone-left { left: 0; }
.reader-nav-zone-right { right: 0; }
.nav-arrow {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(var(--v-theme-on-surface), 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ---- Toolbar ---- */
.reader-toolbar {
  flex-shrink: 0;
  z-index: 20;
}
.search-bar {
  padding: 8px 16px;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

/* ---- Reading area ---- */
.reader-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: auto;
  background-color: var(--bg-color);
  position: relative;
}
.chapter-loading-bar {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
}
.reader-container::-webkit-scrollbar {
  width: 8px;
}
.reader-container::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface), 0.15);
  border-radius: 4px;
}
.reader-container::-webkit-scrollbar-track {
  background: transparent;
}

.reader-content-wrapper {
  max-width: var(--page-w);
  margin: 0 auto;
  padding: 24px 16px 16px;
  position: relative;
  z-index: 1;
}

/* ---- Background image overlay ---- */
.reader-container::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: var(--bg-img);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  opacity: calc(1 - var(--bg-opacity));
  pointer-events: none;
  z-index: 0;
}

/* ---- Chapter title ---- */
.chapter-title {
  font-size: 22px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  color: rgb(var(--v-theme-on-surface));
}

/* ---- Content ---- */
.reader-content {
  font-size: var(--font-s);
  line-height: var(--line-h);
  font-family: var(--font-f);
  font-weight: var(--font-w);
  word-break: break-word;
  overflow-wrap: break-word;
  color: var(--text-color);
}

/* paragraph inside content */
.reader-content :deep(p) {
  margin: 0 0 var(--para-sp) 0;
  text-indent: var(--text-ident);
}

.reader-content :deep(img) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 16px auto;
}

.reader-content :deep(h1),
.reader-content :deep(h2),
.reader-content :deep(h3),
.reader-content :deep(h4) {
  margin-top: 1.2em;
  margin-bottom: 0.6em;
  text-indent: 0;
}

/* ---- Chapter end navigation ---- */
.chapter-end-nav {
  text-align: center;
  padding: 32px 0 16px;
}
.chapter-nav-row {
  margin-bottom: 8px;
}

/* ---- Bottom controls ---- */
.bottom-controls {
  flex-shrink: 0;
  background: rgb(var(--v-theme-surface));
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  padding: 4px 16px 0;
}
.slider-container {
  max-width: 600px;
  margin: 0 auto;
}

/* ---- Selection floating menu ---- */
.selection-menu {
  position: fixed;
  z-index: 100;
  background: rgb(var(--v-theme-surface));
  border-radius: 10px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18);
  display: flex;
  align-items: center;
  padding: 4px 6px;
  gap: 2px;
}
.selection-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface));
  font-size: 12px;
  white-space: nowrap;
  transition: background 0.12s;
}
.selection-btn:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.selection-label {
  line-height: 1;
}
.selection-divider {
  width: 1px;
  height: 20px;
  background: rgba(var(--v-theme-on-surface), 0.12);
  margin: 0 4px;
}

/* ---- Annotation color dot ---- */
.annotation-color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ---- Dictionary ---- */
.definition-list {
  padding-left: 16px;
  font-size: 14px;
}

/* ---- Selected text preview ---- */
.selected-preview {
  max-height: 80px;
  overflow-y: auto;
  padding: 8px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border-radius: 6px;
  font-style: italic;
}

/* ---- Auto-scroll indicator ---- */
.auto-scroll-indicator {
  position: fixed;
  bottom: 60px;
  right: 16px;
  z-index: 50;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: 6px 12px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  font-size: 13px;
}

/* ---- Theme overrides ---- */
.reader-theme-sepia .reader-container {
  background: #f4ecd8;
}
.reader-theme-sepia .reader-content {
  color: #3e2e1a;
}
.reader-theme-sepia .chapter-title {
  color: #3e2e1a;
  border-bottom-color: rgba(62, 46, 26, 0.15);
}

.reader-theme-dark .reader-container {
  background: #1a1a2e;
}
.reader-theme-dark .reader-content {
  color: #d4d4d4;
}

/* ---- Reading stats overlay ---- */
.reading-stats {
  position: fixed;
  bottom: 60px;
  left: 16px;
  z-index: 50;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  padding: 4px 10px;
  border-radius: 14px;
  font-size: 12px;
  display: flex;
  align-items: center;
  pointer-events: none;
  user-select: none;
}

.reading-stats-overlay {
  position: fixed;
  bottom: 80px;
  right: 16px;
  z-index: 50;
  background: rgba(0, 0, 0, 0.78);
  color: #fff;
  border-radius: 12px;
  padding: 12px 14px;
  min-width: 180px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(8px);
  user-select: none;
}
.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  opacity: 0.8;
  letter-spacing: 0.5px;
}
.stats-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stats-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  gap: 12px;
}
.stats-label {
  opacity: 0.65;
}
.stats-value {
  font-weight: 600;
  color: #a5d6ff;
}

/* ---- Focus mode ---- */
.focus-mode .reader-content :deep(p) {
  transition: opacity 0.35s ease, filter 0.35s ease;
  opacity: 0.22;
  filter: blur(0.6px);
}
.focus-mode .reader-content :deep(p.focus-active) {
  opacity: 1;
  filter: none;
}
.focus-mode .reader-content :deep(p.focus-active)::first-line {
  font-weight: 500;
}
/* Progressive dimming: closer paragraphs are slightly more visible */
.focus-mode .reader-content :deep(p[style*='--focus-dist: 1']) {
  opacity: 0.45;
  filter: blur(0.2px);
}
.focus-mode .reader-content :deep(p[style*='--focus-dist: 2']) {
  opacity: 0.32;
  filter: blur(0.4px);
}
.focus-mode .reader-content :deep(p[style*='--focus-dist: 3']) {
  opacity: 0.25;
  filter: blur(0.5px);
}
</style>
