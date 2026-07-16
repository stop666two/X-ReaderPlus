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
          <v-tooltip v-if="internalNavStack.length > 0" text="返回 (内部链接)" location="bottom">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-arrow-u-left-top" size="small" variant="text" color="warning" @click="goInternalBack" />
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

          <v-tooltip text="滚动阅读" location="bottom">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-format-list-bulleted" size="small" variant="text" :color="reader.readingMode === 'scroll' ? 'primary' : ''" @click="onReadingModeChange('scroll')" />
            </template>
          </v-tooltip>
          <v-tooltip text="翻页阅读" location="bottom">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-book-open-page-variant" size="small" variant="text" :color="reader.readingMode === 'pagination' ? 'primary' : ''" @click="onReadingModeChange('pagination')" />
            </template>
          </v-tooltip>
          <v-tooltip text="自动滚屏" location="bottom">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-play" size="small" variant="text" :color="reader.readingMode === 'auto' ? 'primary' : ''" @click="onReadingModeChange('auto')" />
            </template>
          </v-tooltip>

          <v-divider vertical class="mx-1" />

          <v-tooltip text="专注模式 (Ctrl+Shift+F)" location="bottom">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-image-filter-center-focus" size="small" variant="text" :color="settings.focusMode ? 'primary' : ''" @click="settings.setFocusMode(!settings.focusMode)" />
            </template>
          </v-tooltip>

          <v-menu>
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-timer-outline" size="small" variant="text" :color="pomState !== 'idle' ? 'primary' : ''" />
            </template>
            <v-card min-width="220" class="pa-3">
              <div class="text-center">
                <div class="text-h5 font-weight-bold my-1">{{ pomDisplay }}</div>
                <v-progress-linear :model-value="pomProgress * 100" height="4" color="primary" rounded class="my-2" />
                <div class="text-caption mb-2">
                  {{ pomState === 'idle' ? '准备就绪' : pomState === 'focus' ? '专注中' : pomState === 'break' ? '休息中' : '已暂停' }}
                  <span v-if="pomCycles > 0"> | {{ pomCycles }} 轮</span>
                </div>
                <div class="d-flex justify-center ga-1">
                  <v-btn v-if="pomState === 'idle' || pomState === 'paused'" icon="mdi-play" size="small" color="primary" @click="pomStart" />
                  <v-btn v-if="pomState === 'focus' || pomState === 'break'" icon="mdi-pause" size="small" color="primary" @click="pomPause" />
                  <v-btn v-if="pomState !== 'idle'" icon="mdi-skip-forward" size="small" variant="text" @click="pomSkip" />
                  <v-btn v-if="pomState !== 'idle'" icon="mdi-stop" size="small" variant="text" @click="pomReset" />
                </div>
                <div class="d-flex ga-2 mt-2">
                  <v-text-field v-model.number="pomFocus" label="专注" type="number" density="compact" hide-details variant="outlined" :min="1" :max="120" style="width:80px" />
                  <v-text-field v-model.number="pomBreak" label="休息" type="number" density="compact" hide-details variant="outlined" :min="1" :max="60" style="width:80px" />
                </div>
              </div>
            </v-card>
          </v-menu>

          <v-menu>
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-volume-high" size="small" variant="text" :color="ambient.isPlaying() ? 'primary' : ''" />
            </template>
            <v-card min-width="200" class="pa-3">
              <div class="text-caption font-weight-medium mb-1">白噪音</div>
              <div class="d-flex flex-wrap ga-1 mb-2">
                <v-btn
                  v-for="[type, cfg] in soundTypes"
                  :key="type"
                  :icon="cfg.icon"
                  size="small"
                  variant="text"
                  :color="ambient.isPlaying(type) ? 'primary' : ''"
                  @click="ambient.isPlaying(type) ? ambient.stop() : ambient.play(type)"
                />
              </div>
              <v-slider v-model="ambientVolume" min="0" max="1" step="0.05" density="compact" hide-details class="mt-1" @update:model-value="ambient.setVolume($event)" />
              <div class="d-flex justify-space-between text-caption text-medium-emphasis px-1">
                <span>静音</span>
                <span>最大</span>
              </div>
              <v-btn v-if="ambient.isPlaying()" variant="text" color="error" size="small" class="mt-1" block @click="ambient.stop()">
                停止
              </v-btn>
            </v-card>
          </v-menu>

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
              @update:model-value="debouncedSearch"
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

    <!-- Integrity warning -->
    <v-alert
      v-if="reader.contentIntegrity === false"
      density="compact"
      type="warning"
      variant="tonal"
      class="ma-2"
      closable
      @click:close="reader.contentIntegrity = null"
    >
      文件完整性校验失败！内容可能已被篡改。
    </v-alert>

    <!-- Reading area -->
    <div
      class="reader-container"
      :class="{ 'focus-mode': settings.focusMode, 'paginated': reader.readingMode === 'pagination' }"
      ref="readerContainer"
      @scroll="onScroll"
      @mousemove="resetToolbarTimer"
      @click="onReaderClick"
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
          ref="readerContentRef"
          class="reader-content"
          :style="readerStyles"
          v-html="sanitizedContent"
          @click="handleContentClick"
        />
        <div
          ref="lazySentinel"
          class="lazy-sentinel"
          v-if="totalSegmentCount > INITIAL_SEGMENT_COUNT && renderedSegmentCount < totalSegmentCount"
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

        <!-- Pagination bar -->
        <div v-if="reader.readingMode === 'pagination'" class="pagination-bar">
          <v-btn icon="mdi-chevron-left" size="small" variant="text" :disabled="reader.currentPage <= 0" @click="reader.prevPage(); scrollToCurrentPage()" />
          <span class="text-caption mx-2">{{ reader.currentPage + 1 }} / {{ reader.totalPages }}</span>
          <v-btn icon="mdi-chevron-right" size="small" variant="text" :disabled="reader.currentPage >= reader.totalPages - 1" @click="reader.nextPage(); scrollToCurrentPage()" />
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
          v-for="(tocItem, idx) in reader.rawToc"
          :key="idx"
          :title="tocItem.label"
          :active="tocItem.chapterIndex === reader.currentChapterIndex"
          @click="goToChapterFromToc(tocItem)"
        >
          <template #append>
            <v-icon
              v-if="tocItem.chapterIndex >= 0 && readChaptersSet.has(reader.bookId + ':' + tocItem.chapterIndex)"
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
          @click="scrollToAnnotation(ann)"
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
import { useRouter, useRoute, onBeforeRouteLeave } from 'vue-router'
import { useReaderStore } from '@/stores/reader'
import { useSettingsStore } from '@/stores/settings'
import { useBookshelfStore } from '@/stores/bookshelf'
import { useThemeStore } from '@/stores/theme'
import { HIGHLIGHT_COLORS } from '@/constants'
import { logger } from '@/services/log'
import { renderPage, releasePdfCache } from '@/services/pdf-renderer'
import type { Annotation, HighlightColor, ReadingMode } from '@/types'
import { usePomodoro } from '@/composables/usePomodoro'
import { useAmbientSound, SOUND_CONFIGS, type SoundType } from '@/composables/useAmbientSound'

const router = useRouter()
const route = useRoute()
const reader = useReaderStore()
const settings = useSettingsStore()
const bookshelf = useBookshelfStore()
const theme = useThemeStore()
const ambient = useAmbientSound()
const soundTypes = Object.entries(SOUND_CONFIGS) as [SoundType, { label: string; icon: string }][]
const {
  state: pomState,
  displayTime: pomDisplay,
  progress: pomProgress,
  cycles: pomCycles,
  focusMinutes: pomFocus,
  breakMinutes: pomBreak,
  start: pomStart,
  pause: pomPause,
  reset: pomReset,
  skip: pomSkip
} = usePomodoro()

const readerRef = ref<HTMLElement | null>(null)
const readerContainer = ref<HTMLElement | null>(null)
const readerContentRef = ref<HTMLElement | null>(null)
const internalNavStack = ref<number[]>([])
const searchInput = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null
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
const showStatsOverlay = ref(false)

const ambientVolume = ref(0.5)

const highlightColors = HIGHLIGHT_COLORS

let toolbarTimer: ReturnType<typeof setTimeout> | null = null
let readingTimeInterval: ReturnType<typeof setInterval> | null = null
const readingSeconds = ref(0)
let lastSavedSeconds = 0
let isChapterTransition = false
let isNavigatingBack = false

const readingProgress = ref(0)
let autoSaveTimer: ReturnType<typeof setInterval> | null = null
let customCssStyleEl: HTMLStyleElement | null = null

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

// ---- Lazy rendering for long chapters ----
const INITIAL_SEGMENT_COUNT = 30
const LOAD_MORE_COUNT = 20
const renderedSegmentCount = ref(INITIAL_SEGMENT_COUNT)
const totalSegmentCount = ref(0)
const lazySentinel = ref<HTMLElement | null>(null)
let sentinelObserver: IntersectionObserver | null = null

// ---- PDF page lazy rendering ----
const isPdfBook = computed(() => currentBook.value?.format === 'pdf')
let pdfPageObserver: IntersectionObserver | null = null
const renderedPdfPages = new Set<number>()
let pdfRenderQueue: Promise<void> = Promise.resolve()

function setupPdfPageObserver() {
  teardownPdfPageObserver()
  if (!readerContainer.value || !isPdfBook.value) return

  // Reset rendered pages set when chapter changes
  renderedPdfPages.clear()

  pdfPageObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const el = entry.target as HTMLElement
        const pageNum = parseInt(el.dataset.page || '', 10)
        if (!pageNum || renderedPdfPages.has(pageNum)) continue
        renderedPdfPages.add(pageNum)

        const bookPath = currentBook.value?.path
        if (!bookPath) continue

        // Chain renders to avoid overwhelming pdfjs
        pdfRenderQueue = pdfRenderQueue.then(async () => {
          try {
            const dataUrl = await renderPage(reader.bookId, bookPath, pageNum)
            if (dataUrl) {
              const img = document.createElement('img')
              img.src = dataUrl
              img.alt = `第 ${pageNum} 页`
              img.className = 'pdf-page-img'
              // Clear placeholder
              el.innerHTML = ''
              el.appendChild(img)
            } else {
              // Render failed — show fallback text
              const pageDiv = el.closest('.pdf-page') as HTMLElement | null
              const fallbackText = pageDiv?.dataset.text || ''
              el.innerHTML = fallbackText
                ? `<div class="pdf-page-fallback"><p>${fallbackText}</p></div>`
                : `<div class="pdf-page-error">第 ${pageNum} 页渲染失败</div>`
            }
          } catch {
            // PDF page render failed at canvas level — show fallback
            el.innerHTML = `<div class="pdf-page-error">第 ${pageNum} 页渲染失败</div>`
          }
        })
      }
    },
    {
      root: readerContainer.value,
      rootMargin: '400px 0px',
      threshold: 0.01
    }
  )

  // Observe all .pdf-page-img-container elements
  nextTick(() => {
    const containers = readerContainer.value?.querySelectorAll('.pdf-page-img-container')
    containers?.forEach(el => pdfPageObserver?.observe(el))
  })
}

function teardownPdfPageObserver() {
  if (pdfPageObserver) {
    pdfPageObserver.disconnect()
    pdfPageObserver = null
  }
  renderedPdfPages.clear()
  pdfRenderQueue = Promise.resolve()
}

function splitHtmlIntoSegments(html: string): string[] {
  if (!html) return []
  const segments = html.split(/(?<=<\/(?:p|h[1-6]|div|blockquote|pre|ul|ol|table|figure)\s*>)/gi)
  return segments.filter(s => s.trim().length > 0)
}

function setupLazySentinel() {
  if (sentinelObserver) sentinelObserver.disconnect()
  const sentinel = lazySentinel.value
  if (!sentinel || !readerContainer.value) return
  sentinelObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && renderedSegmentCount.value < totalSegmentCount.value) {
      renderedSegmentCount.value = Math.min(
        renderedSegmentCount.value + LOAD_MORE_COUNT,
        totalSegmentCount.value
      )
    }
  }, {
    root: readerContainer.value,
    rootMargin: '600px'
  })
  sentinelObserver.observe(sentinel)
}

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

const lazyContent = computed(() => {
  const chapter = reader.currentChapter
  if (!chapter) return ''
  const html = stripLeadingTitle(chapter.content, chapter.title)
  const segments = splitHtmlIntoSegments(html)
  if (segments.length <= INITIAL_SEGMENT_COUNT) return html
  return segments.slice(0, renderedSegmentCount.value).join('')
})

const _sanitizedContent = ref('')

// DOMPurify — static import so it's available synchronously
import DOMPurify from 'dompurify'

const sanitizedContent = computed(() => {
  const raw = lazyContent.value
  if (!raw) return ''
  let result = raw
  // First pass: sanitize with DOMPurify
  result = DOMPurify.sanitize(result, {
    ALLOWED_TAGS: [
      'h1','h2','h3','h4','h5','h6','p','br','hr','b','i','em','strong',
      'u','s','mark','small','sub','sup','ul','ol','li',
      'blockquote','pre','code','a','img','span','div',
      'table','thead','tbody','tr','th','td','figure','figcaption'
    ],
    ALLOWED_ATTR: ['href','src','alt','title','class','id','width','height','style'],
    ALLOW_DATA_ATTR: false,
    ADD_URI_SAFE_ATTR: ['src']
  })
  // Second pass: rewrite links for safe in-app navigation
  let count = 0
  result = result
    .replace(/<a\b([^>]*?)href\s*=\s*"([^"]*)"([^>]*)>/gi, (_, pre, val, post) => {
      count++; return `<a${pre}data-href="${val}"${post}>`
    })
    .replace(/<a\b([^>]*?)href\s*=\s*'([^']*)'([^>]*)>/gi, (_, pre, val, post) => {
      count++; return `<a${pre}data-href='${val}'${post}>`
    })
  if (count > 0) { logger.info(`Rewrote ${count} links in chapter`) }
  return result
})

watch(() => reader.currentChapter, (chapter) => {
  if (!chapter) return
  const html = stripLeadingTitle(chapter.content, chapter.title)
  const segments = splitHtmlIntoSegments(html)
  totalSegmentCount.value = segments.length
}, { immediate: true })

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
  // Only mark as read if user has scrolled past 90% of chapter
  if (readerContainer.value) {
    const { scrollTop, scrollHeight, clientHeight } = readerContainer.value
    const scrollPercent = scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 1
    if (scrollPercent < 0.9) return
  }
  const key = `${bookId}:${chapterIndex}`
  const s = new Set(bookshelf.readChapters)
  s.add(key)
  bookshelf.readChapters = s
  persistReadChapters(bookId)
}

async function loadPersistedReadChapters(bookId: string) {
  if (!window.electronAPI) { bookshelf.readChapters = new Set(); return }
  try {
    const v = await window.electronAPI.config.get(`readChapters:${bookId}`)
    if (v) {
      const arr: string[] = JSON.parse(v)
      bookshelf.readChapters = new Set(arr)
    } else {
      bookshelf.readChapters = new Set()
    }
  } catch { logger.error('加载已读章节失败'); bookshelf.readChapters = new Set() }
}

async function persistReadChapters(bookId: string) {
  if (!window.electronAPI) return
  try {
    const arr = Array.from(bookshelf.readChapters)
    await window.electronAPI.config.set(`readChapters:${bookId}`, JSON.stringify(arr))
  } catch { logger.error('持久化已读章节失败') }
}

async function loadPersistedScrollPositions(bookId: string) {
  if (!window.electronAPI) return
  try {
    const v = await window.electronAPI.config.get(`scroll:${bookId}`)
    if (v) {
      const data: Record<number, number> = JSON.parse(v)
      // Populate reader's in-memory scroll positions
      for (const [key, val] of Object.entries(data)) {
        reader.saveScrollPosition(Number(key), val)
      }
    }
  } catch { logger.error('加载滚动位置失败') }
}

async function persistScrollPositions(bookId: string) {
  if (!window.electronAPI) return
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
    await window.electronAPI.config.set(`scroll:${bookId}`, JSON.stringify(data))
  } catch { logger.error('持久化滚动位置失败') }
}

const readChaptersSet = computed(() => bookshelf.readChapters)

function scrollToAnnotation(ann: Annotation) {
  // If not in same chapter, navigate first
  if (ann.chapterIndex !== reader.currentChapterIndex) {
    reader.navigateToChapter(ann.chapterIndex)
    // After chapter loads, scroll to annotation text
    const unwatch = watch(() => reader.currentChapter, () => {
      nextTick(() => { highlightAnnotationInDom(ann.text); reader.showAnnotations = false })
      unwatch()
    }, { once: true })
  } else {
    highlightAnnotationInDom(ann.text)
    reader.showAnnotations = false
  }
}

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
  if (!anns.length) return

  const walker = document.createTreeWalker(readerContainer.value!, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let n: Text | null
  while ((n = walker.nextNode() as Text | null)) textNodes.push(n)

  for (const ann of anns) {
    if (ann.type !== 'highlight') continue
    const colorCfg = HIGHLIGHT_COLORS.find(c => c.value === ann.color)
    const bg = colorCfg?.bg || 'rgba(255,235,59,0.35)'
    const text = ann.text
    if (!text) continue
    for (const node of textNodes) {
      const idx = node.textContent?.indexOf(text) ?? -1
      if (idx < 0) continue
      try {
        const r = document.createRange()
        r.setStart(node, idx)
        r.setEnd(node, idx + text.length)
        const span = document.createElement('span')
        span.style.backgroundColor = bg
        span.style.borderRadius = '2px'
        span.style.padding = '0 2px'
        if (ann.note) span.title = ann.note
        r.surroundContents(span)
      } catch { /* surroundContents fails when range spans multiple elements */ }
      break
    }
  }
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

  // Load content for the current chapter (fixes C-5 race condition)
  reader.loadChapterContent(reader.currentChapterIndex)

  sliderValue.value = reader.currentChapterIndex

  // Restore scroll position for the saved chapter
  await nextTick()
  if (readerContainer.value) {
    const ciParam = route.query.ci
    if (ciParam !== undefined) {
      const targetCi = parseInt(ciParam as string)
      if (targetCi >= 0 && targetCi < reader.chapterCount) {
        reader.currentChapterIndex = targetCi; sliderValue.value = targetCi; await nextTick()
      }
    }
    const saved = reader.getScrollPosition(reader.currentChapterIndex)
    if (saved > 0) {
      readerContainer.value.scrollTop = saved
    } else {
      readerContainer.value.scrollTop = 0
    }
  }

  // Start reading time tracking
  startReadingTimer()
}

// ---- Navigation ----

function handleContentClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const anchor = target.closest('a')
  if (!anchor) return
  const href = anchor.getAttribute('data-href') || anchor.getAttribute('href')
  console.log('[link click]', { tag: anchor.tagName, href, dataHref: anchor.getAttribute('data-href'), outerHTML: anchor.outerHTML?.slice(0, 100) })
  if (!href) return
  e.preventDefault()
  e.stopPropagation()
  if (href.startsWith('#')) {
    const id = href.slice(1)
    const escaped = id.replace(/[^a-zA-Z0-9_-]/g, '\\$&')
    const el = readerContentRef.value?.querySelector(`[id="${escaped}"]`) || document.getElementById(id)
    if (el) {
      internalNavStack.value.push(readerContainer.value?.scrollTop || 0)
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      resetToolbarTimer()
    }
  } else if (/^https?:\/\//i.test(href)) {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(href)
    } else {
      window.open(href, '_blank')
    }
  }
}

function goInternalBack() {
  const pos = internalNavStack.value.pop()
  if (pos !== undefined && readerContainer.value) {
    readerContainer.value.scrollTop = pos
  }
}

async function goBack() {
  isNavigatingBack = true
  saveScrollNow()
  const scrollHeight = readerContainer.value
    ? readerContainer.value.scrollHeight - readerContainer.value.clientHeight
    : 1
  const progress = scrollHeight > 0
    ? (readerContainer.value?.scrollTop || 0) / scrollHeight
    : 0
  markChapterRead(reader.bookId, reader.currentChapterIndex)
  reader.stopAutoScroll()
  stopReadingTimer()

  // Save progress BEFORE navigating
  try {
    await bookshelf.updateBookProgress(reader.bookId, reader.currentChapterIndex, progress)
  } catch {}

  if (readingSeconds.value > lastSavedSeconds) {
    bookshelf.updateBookReadingTime(reader.bookId, readingSeconds.value - lastSavedSeconds)
    readingSeconds.value = 0; lastSavedSeconds = 0
  }
  // Fire remaining saves in background
  persistScrollPositions(reader.bookId)
  persistReadChapters(reader.bookId)

  router.push({ name: 'bookshelf' })
}

function goNextChapter() {
  if (!reader.hasNextChapter) return
  saveScrollNow()
  isChapterTransition = true
  isChapterLoading.value = true
  internalNavStack.value = []

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
  internalNavStack.value = []
  reader.previousChapter()
  sliderValue.value = reader.currentChapterIndex
  persistScrollPositions(reader.bookId)
  // Scroll restored by lazyContent watcher after content renders
}

function onSliderChange(val: number) {
  if (val === reader.currentChapterIndex) return
  saveScrollNow()
  isChapterTransition = true
  isChapterLoading.value = true
  persistScrollPositions(reader.bookId)
  internalNavStack.value = []
  reader.navigateToChapter(val)
}

function goToChapterFromToc(tocItem: { chapterIndex: number; href?: string }) {
  const idx = tocItem.chapterIndex
  if (idx < 0 || idx >= reader.chapters.length) {
    reader.showToc = false
    return
  }
  internalNavStack.value = []
  markChapterRead(reader.bookId, reader.currentChapterIndex)
  saveScrollNow()
  isChapterTransition = true
  isChapterLoading.value = true
  persistScrollPositions(reader.bookId)
  reader.navigateToChapter(idx)
  reader.showToc = false
  // After chapter loads, scroll to fragment if href has one
  if (tocItem.href) {
    const fragment = tocItem.href.split('#')[1]
    if (fragment) {
      setTimeout(() => {
        const escaped = fragment.replace(/[^a-zA-Z0-9_-]/g, '\\$&')
        const el = readerContentRef.value?.querySelector(`[id="${escaped}"]`) || document.getElementById(fragment)
        if (el) {
          el.scrollIntoView({ behavior: 'auto', block: 'start' })
        }
      }, 300)
    }
  }
}

// ---- Scroll ----

let scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null
const SCROLL_DEBOUNCE_MS = 500

function onScroll() {
  if (isChapterTransition) return
  if (!readerContainer.value) return

  const st = readerContainer.value.scrollTop
  const sh = readerContainer.value.scrollHeight
  const ch = readerContainer.value.clientHeight

  if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer)
  scrollDebounceTimer = setTimeout(() => {
    reader.saveScrollPosition(reader.currentChapterIndex, st)
    const scrollRange = sh - ch
    const progress = scrollRange > 0 ? Math.min(1, Math.max(0, st / scrollRange)) : 0
    readingProgress.value = Math.round(progress * 100)
    bookshelf.updateBookProgress(reader.bookId, reader.currentChapterIndex, progress)
    if (progress >= 0.8) {
      markChapterRead(reader.bookId, reader.currentChapterIndex)
    }
  }, SCROLL_DEBOUNCE_MS)
}

// ---- Focus mode ----

let _focusIndex = 0

function getFocusableParagraphs(): HTMLElement[] {
  const contentEl = readerContainer.value?.querySelector<HTMLElement>('.reader-content')
  if (!contentEl) return []
  return Array.from(contentEl.querySelectorAll<HTMLElement>('p, h1, h2, h3, h4, h5, h6, blockquote, li'))
    .filter(el => el.textContent?.trim() && el.offsetHeight > 0)
}

function centerFocusParagraph(index: number) {
  const paragraphs = getFocusableParagraphs()
  if (paragraphs.length === 0) return
  const idx = Math.max(0, Math.min(index, paragraphs.length - 1))
  _focusIndex = idx
  paragraphs.forEach(p => p.classList.remove('focus-active'))
  const el = paragraphs[idx]
  el.classList.add('focus-active')
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

let _focusWheelTimer: ReturnType<typeof setTimeout> | null = null

function onFocusWheel(e: WheelEvent) {
  e.preventDefault()
  if (_focusWheelTimer) return
  _focusWheelTimer = setTimeout(() => { _focusWheelTimer = null }, 100)
  centerFocusParagraph(_focusIndex + (e.deltaY > 0 ? 1 : -1))
}

function onFocusKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    e.preventDefault(); centerFocusParagraph(_focusIndex + 1)
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    e.preventDefault(); centerFocusParagraph(_focusIndex - 1)
  } else if (e.key === 'PageDown') {
    e.preventDefault(); centerFocusParagraph(_focusIndex + 5)
  } else if (e.key === 'PageUp') {
    e.preventDefault(); centerFocusParagraph(_focusIndex - 5)
  } else if (e.key === 'Home') {
    e.preventDefault(); centerFocusParagraph(0)
  } else if (e.key === 'End') {
    e.preventDefault(); centerFocusParagraph(9999)
  }
}

watch(() => settings.focusMode, (val) => {
  const container = readerContainer.value
  if (!container) return
  if (val) {
    container.addEventListener('wheel', onFocusWheel, { passive: false })
    document.addEventListener('keydown', onFocusKeydown)
    nextTick(() => {
      const paragraphs = getFocusableParagraphs()
      if (paragraphs.length === 0) return
      const center = container.scrollTop + container.clientHeight / 2
      let best = 0
      let bestDist = Infinity
      paragraphs.forEach((p, i) => {
        const dist = Math.abs(p.offsetTop - center)
        if (dist < bestDist) { bestDist = dist; best = i }
      })
      centerFocusParagraph(best)
    })
  } else {
    container.removeEventListener('wheel', onFocusWheel)
    document.removeEventListener('keydown', onFocusKeydown)
    container.querySelectorAll('.focus-active').forEach(el => el.classList.remove('focus-active'))
    _focusIndex = 0
  }
})

// Watch chapter index changes to restore scroll
watch(() => reader.currentChapterIndex, (newIdx) => {
  renderedSegmentCount.value = INITIAL_SEGMENT_COUNT
  if (!isChapterTransition && !isNavigatingBack) return
  isChapterTransition = false
  sliderValue.value = newIdx
  // Restore scroll after content renders (deferred to lazyContent watcher)
  nextTick(() => {
    applyChapterAnnotations()
    isChapterLoading.value = false
    if (settings.focusMode) { centerFocusParagraph(_focusIndex) }
    if (isPdfBook.value) setupPdfPageObserver()
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

onUnmounted(() => {
  if (readerContainer.value) {
    readerContainer.value.removeEventListener('wheel', onFocusWheel)
    document.removeEventListener('keydown', onFocusKeydown)
  }
})

// Track whether this is a chapter transition or lazy load
let _isChapterChange = true

// Chapter changes: save old position, reset scroll, set flag
watch(() => reader.currentChapter, () => {
  _isChapterChange = true
  isChapterTransition = true
  if (readerContainer.value) readerContainer.value.scrollTop = 0
})

// Lazy content loads: restore saved position on chapter changes, just re-attach on lazy loads
watch(lazyContent, () => {
  const wasChapterChange = _isChapterChange
  _isChapterChange = false
  const restoreScroll = () => {
    setupLazySentinel()
    if (isPdfBook.value) setupPdfPageObserver()
    if (wasChapterChange) {
      const saved = reader.getScrollPosition(reader.currentChapterIndex)
      if (readerContainer.value && saved > 0 && readerContainer.value.scrollHeight > 0) {
        readerContainer.value.scrollTop = Math.min(saved, readerContainer.value.scrollHeight - readerContainer.value.clientHeight)
      }
    }
  }
  requestAnimationFrame(() => requestAnimationFrame(restoreScroll))
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

  // All shortcuts read from settings.readingShortcuts — no hardcoded bindings
  if (shortcut === sc.prevChapter) {
    e.preventDefault()
    if (!isChapterTransition) goPreviousChapter()
  } else if (shortcut === sc.nextChapter) {
    e.preventDefault()
    if (!isChapterTransition) goNextChapter()
  } else if (shortcut === sc.search) {
    e.preventDefault()
    toggleSearch()
  } else if (shortcut === sc.chapterStart) {
    e.preventDefault()
    if (readerContainer.value) {
      readerContainer.value.scrollTo({ top: 0, behavior: 'smooth' })
    }
  } else if (shortcut === sc.chapterEnd) {
    e.preventDefault()
    if (readerContainer.value) {
      readerContainer.value.scrollTo({ top: readerContainer.value.scrollHeight, behavior: 'smooth' })
    }
  } else if (e.ctrlKey && e.shiftKey && e.key === 'F') {
    e.preventDefault()
    settings.setFocusMode(!settings.focusMode)
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
    if (reader.readingMode === 'pagination') {
      reader.prevPage()
      scrollToCurrentPage()
    } else if (readerContainer.value) {
      readerContainer.value.scrollBy({ top: -readerContainer.value.clientHeight * 0.9, behavior: 'smooth' })
    }
  } else if (shortcut === sc.pageDown) {
    e.preventDefault()
    if (reader.readingMode === 'pagination') {
      reader.nextPage()
      scrollToCurrentPage()
    } else if (readerContainer.value) {
      readerContainer.value.scrollBy({ top: readerContainer.value.clientHeight * 0.9, behavior: 'smooth' })
    }
  } else if (e.key === 'ArrowLeft' && reader.readingMode === 'pagination') {
    e.preventDefault()
    reader.prevPage()
    scrollToCurrentPage()
  } else if (e.key === 'ArrowRight' && reader.readingMode === 'pagination') {
    e.preventDefault()
    reader.nextPage()
    scrollToCurrentPage()
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

function debouncedSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => performSearch(), 300)
}

function prevSearchResult() {
  if (reader.searchResults.length === 0) return
  reader.currentSearchIndex = reader.currentSearchIndex > 0
    ? reader.currentSearchIndex - 1
    : reader.searchResults.length - 1
  scrollToSearchResult()
}

function nextSearchResult() {
  if (reader.searchResults.length === 0) return
  reader.currentSearchIndex = reader.currentSearchIndex < reader.searchResults.length - 1
    ? reader.currentSearchIndex + 1
    : 0
  scrollToSearchResult()
}

function scrollToSearchResult() {
  if (!readerContainer.value || reader.searchResults.length === 0) return
  const result = reader.searchResults[reader.currentSearchIndex]
  if (!result) return

  // Navigate to the chapter containing the result
  if (result.chapterIndex !== reader.currentChapterIndex) {
    reader.navigateToChapter(result.chapterIndex)
    sliderValue.value = result.chapterIndex
    nextTick(() => highlightAndScrollToMatch(result))
  } else {
    highlightAndScrollToMatch(result)
  }
}

function highlightAndScrollToMatch(result: { text: string; chapterIndex: number }) {
  if (!readerContainer.value) return
  // Clear previous highlights
  readerContainer.value.querySelectorAll('.search-highlight').forEach((el: any) => {
    const parent = el.parentNode
    if (parent) { parent.replaceChild(document.createTextNode(el.textContent || ''), el); parent.normalize() }
  })

  // Find and highlight the match text
  const walker = document.createTreeWalker(readerContainer.value, NodeFilter.SHOW_TEXT)
  let node: Text | null
  const searchText = result.text.trim()
  while ((node = walker.nextNode() as Text | null)) {
    const content = node.textContent || ''
    const idx = content.toLowerCase().indexOf(searchText.toLowerCase())
    if (idx >= 0) {
      const span = document.createElement('span')
      span.className = 'search-highlight'
      span.textContent = content.substring(idx, idx + searchText.length)
      const range = document.createRange()
      range.setStart(node, idx)
      range.setEnd(node, idx + searchText.length)
      range.deleteContents()
      range.insertNode(span)
      // Scroll to it
      span.scrollIntoView({ behavior: 'smooth', block: 'center' })
      break
    }
  }
}

// ---- Selection handling ----

function handleSelection() {
  const container = readerContainer.value
  if (!container || (!container.contains(document.activeElement) && !container.contains(document.getSelection()?.anchorNode ?? null))) {
    selectionMenu.value.visible = false
    return
  }
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

  // Compute precise offsets using Range API — counts text before the selection
  // in the rendered container, not by searching stripped HTML
  const root = readerContainer.value
  if (root) {
    const range = selection.getRangeAt(0)
    const startRange = document.createRange()
    startRange.setStart(root, 0)
    try {
      startRange.setEnd(range.startContainer, range.startOffset)
    } catch {
      startRange.setEnd(range.startContainer, 0)
    }
    const startOffset = startRange.toString().length

    const endRange = document.createRange()
    endRange.setStart(root, 0)
    try {
      endRange.setEnd(range.endContainer, range.endOffset)
    } catch {
      endRange.setEnd(range.endContainer, 0)
    }
    const endOffset = endRange.toString().length

    selectedOffset.value = {
      start: startOffset,
      end: endOffset
    }
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
    try { range.surroundContents(span) } catch { /* selection may span across element boundaries */ }
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
  navigator.clipboard.writeText(selectedText.value).catch((e: any) => logger.error('Clipboard write failed:', e))
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

const DICT_CACHE_KEY = 'dict_cache'

function getDictCache(): Record<string, any> {
  try { return JSON.parse(localStorage.getItem(DICT_CACHE_KEY) || '{}') } catch { return {} }
}

function setDictCache(word: string, data: any) {
  const cache = getDictCache()
  cache[word.toLowerCase()] = { data, cachedAt: Date.now() }
  // Keep max 200 entries
  const keys = Object.keys(cache)
  if (keys.length > 200) {
    const sorted = keys.sort((a, b) => cache[a].cachedAt - cache[b].cachedAt)
    delete cache[sorted[0]]
  }
  try { localStorage.setItem(DICT_CACHE_KEY, JSON.stringify(cache)) } catch {}
}

async function lookupWord(word: string) {
  dictWord.value = word
  showDictResult.value = true
  dictLoading.value = true
  dictError.value = ''

  // Check local cache first
  const cache = getDictCache()
  const cached = cache[word.toLowerCase()]
  if (cached) {
    dictResult.value = cached.data
    dictLoading.value = false
    return
  }

  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
    if (!response.ok) throw new Error('未找到释义')
    const data = await response.json()
    dictResult.value = data[0]
    setDictCache(word, data[0])
  } catch (e: any) {
    dictError.value = '查询失败: ' + (e.message || '网络错误')
    dictResult.value = null
  } finally {
    dictLoading.value = false
  }
}

// ---- Auto-scroll ----

function onReadingModeChange(mode: ReadingMode) {
  reader.setReadingMode(mode)
  if (mode === 'pagination') {
    if (readerContainer.value) {
      reader.paginateChapter(sanitizedContent.value, readerContainer.value.clientHeight - 80)
    }
    scrollToCurrentPage()
  }
  if (mode === 'auto') {
    reader.startAutoScroll(readerContainer.value)
  }
}

function scrollToCurrentPage() {
  if (!readerContainer.value || reader.pageHeights.length === 0) return
  let offset = 0
  for (let i = 0; i < reader.currentPage; i++) {
    offset += reader.pageHeights[i]
  }
  readerContainer.value.scrollTo({ top: offset, behavior: 'smooth' })
}

function onReaderClick(e: MouseEvent) {
  if (reader.readingMode !== 'pagination') return
  const target = e.target as HTMLElement
  if (target.closest('a') || target.closest('button') || target.closest('.v-btn')) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const x = e.clientX - rect.left
  const w = rect.width
  if (x < w * 0.25) {
    reader.prevPage()
    scrollToCurrentPage()
  } else if (x > w * 0.75) {
    reader.nextPage()
    scrollToCurrentPage()
  }
}

// Repaginate when chapter content changes
watch(() => sanitizedContent.value, () => {
  if (reader.readingMode === 'pagination' && readerContainer.value) {
    nextTick(() => {
      reader.paginateChapter(sanitizedContent.value, readerContainer.value!.clientHeight - 80)
      reader.currentPage = 0
    })
  }
})

function toggleAutoScroll() {
  reader.toggleAutoScroll(readerContainer.value)
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
  const delay = settings.toolbarAutoHideDelay || 4
  // In focus mode, show toolbar briefly then hide quickly
  const actualDelay = settings.focusMode ? Math.min(delay, 2) : delay
  if (actualDelay > 0) {
    toolbarTimer = setTimeout(() => {
      if (!reader.showSearch) {
        reader.showToolbar = false
      }
    }, actualDelay * 1000)
  }
}

// ---- Reading time ----

function handleVisibilityChange() {
  if (document.hidden) {
    // Save accumulated reading time before pausing
    if (readingSeconds.value > lastSavedSeconds) {
      bookshelf.updateBookReadingTime(reader.bookId, readingSeconds.value - lastSavedSeconds)
      lastSavedSeconds = readingSeconds.value
    }
    stopReadingTimer()
  } else {
    startReadingTimer()
  }
}

function startReadingTimer() {
  if (document.hidden) return
  if (readingTimeInterval) clearInterval(readingTimeInterval)
  readingTimeInterval = setInterval(() => {
    readingSeconds.value++
    if (readingSeconds.value % 30 === 0 && readingSeconds.value > lastSavedSeconds) {
      bookshelf.updateBookReadingTime(reader.bookId, readingSeconds.value - lastSavedSeconds)
      lastSavedSeconds = readingSeconds.value
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
  const rawCss = settings.readingSettings.customCSS
  if (rawCss) {
    // Sanitize: remove rules containing url() or @import to prevent data exfiltration
    const css = rawCss
      .split('\n')
      .filter(line => !/(url\s*\(|@import)/i.test(line))
      .join('\n')
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
  window.addEventListener('click', handleContentClick, true)
  resetToolbarTimer()

  // Focus the reader for keyboard events
  readerRef.value?.focus()

  // Custom CSS and auto-save — use nextTick to ensure readerContainer ref is available
  await nextTick()
  injectCustomCSS()
  startAutoSave()
  setupLazySentinel()
  if (isPdfBook.value) setupPdfPageObserver()
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  // Clean up timers
  if (toolbarTimer) clearTimeout(toolbarTimer)
  if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer)
  reader.stopAutoScroll()
  stopReadingTimer()
  stopAutoSave()
  removeCustomCSS()
  if (sentinelObserver) sentinelObserver.disconnect()
  teardownPdfPageObserver()
  if (readingSeconds.value > lastSavedSeconds) {
    bookshelf.updateBookReadingTime(reader.bookId, readingSeconds.value - lastSavedSeconds).catch(() => {})
  }

  // Clean up listeners
  document.removeEventListener('mouseup', handleSelection)
  document.removeEventListener('wheel', onWheel)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('click', handleContentClick, true)
  releasePdfCache()
})

// Use onBeforeRouteLeave to properly await save before navigation
onBeforeRouteLeave(async (_to, _from) => {
  if (!isNavigatingBack) {
    saveScrollNow()
    const scrollHeight = readerContainer.value
      ? readerContainer.value.scrollHeight - readerContainer.value.clientHeight
      : 1
    const progress = scrollHeight > 0
      ? (readerContainer.value?.scrollTop || 0) / scrollHeight
      : 0
    // Save reading time before leaving
    if (readingSeconds.value > lastSavedSeconds) {
      bookshelf.updateBookReadingTime(reader.bookId, readingSeconds.value - lastSavedSeconds)
      readingSeconds.value = 0; lastSavedSeconds = 0
    }
    await Promise.allSettled([
      bookshelf.updateBookProgress(reader.bookId, reader.currentChapterIndex, progress),
      persistScrollPositions(reader.bookId),
      persistReadChapters(reader.bookId)
    ])
  }
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

/* ---- Pagination mode ---- */
.reader-container.paginated {
  overflow-y: hidden;
  scroll-behavior: smooth;
}

.pagination-click-zone {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 30%;
  z-index: 5;
  cursor: pointer;
}
.pagination-click-left {
  left: 0;
}
.pagination-click-right {
  right: 0;
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

.reader-content :deep(a[data-href]) {
  color: var(--reader-accent, #1565C0);
  text-decoration: underline;
  cursor: pointer;
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

/* ---- Comic page ---- */
.reader-content :deep(.comic-page) {
  text-indent: 0;
  margin: 0;
}
.reader-content :deep(.comic-page p) {
  text-indent: 0;
  text-align: center;
  margin: 4px 0;
  color: #888;
  font-size: 13px;
}
.reader-content :deep(.comic-page img) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}

/* ---- Comic truncation notice ---- */
.reader-content :deep(.comic-truncation-notice) {
  text-indent: 0;
  text-align: center;
  padding: 24px 16px;
}
.reader-content :deep(.comic-truncation-notice p) {
  text-indent: 0;
  margin: 0;
  color: #f0a030;
  font-size: 14px;
  font-weight: 500;
}

/* ---- PDF page ---- */
.reader-content :deep(.pdf-page) {
  margin-bottom: 8px;
  text-align: center;
  text-indent: 0;
}
.reader-content :deep(.pdf-page-img-container) {
  display: inline-block;
  max-width: 100%;
  min-height: 120px;
}
.reader-content :deep(.pdf-page-img) {
  max-width: 100%;
  height: auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  display: block;
  margin: 0 auto;
  border-radius: 2px;
}
.reader-content :deep(.pdf-page-placeholder) {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
  color: #999;
  font-size: 14px;
  background: rgba(var(--v-theme-on-surface), 0.03);
  border: 1px dashed rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 4px;
}
.reader-content :deep(.pdf-page-error) {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60px;
  color: #e57373;
  font-size: 13px;
  background: rgba(229, 115, 115, 0.06);
  border-radius: 4px;
}
.reader-content :deep(.pdf-page-fallback) {
  text-align: left;
  padding: 12px 16px;
}
.reader-content :deep(.pdf-page-fallback p) {
  text-indent: 2em;
  margin: 0.5em 0;
  color: var(--text-color);
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
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
  gap: 4px;
  flex-shrink: 0;
}

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

/* ---- Lazy sentinel ---- */
.lazy-sentinel {
  height: 1px;
  width: 100%;
}

/* ---- Focus mode — dim content, highlight active paragraph ---- */
.focus-mode .reader-content :deep(p),
.focus-mode .reader-content :deep(h1),
.focus-mode .reader-content :deep(h2),
.focus-mode .reader-content :deep(h3),
.focus-mode .reader-content :deep(h4),
.focus-mode .reader-content :deep(blockquote),
.focus-mode .reader-content :deep(li) {
  opacity: 0.25;
  transition: opacity 0.3s ease;
}
.focus-mode .reader-content :deep(.focus-active) {
  opacity: 1;
  box-shadow: 0 0 0 4px rgba(var(--v-theme-primary), 0.15);
  border-radius: 6px;
  padding: 4px 8px;
  margin: -4px -8px;
  background: rgba(var(--v-theme-primary), 0.04);
}
/* Search highlight */
:deep(.search-highlight) {
  background: #ff1744;
  color: #fff;
  border-radius: 2px;
  padding: 0 1px;
}
</style>
