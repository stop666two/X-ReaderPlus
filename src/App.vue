<template>
  <v-app :theme="themeStore.current">
    <!-- ========== Startup Loading Screen ========== -->
    <div v-if="!booksLoaded" class="loading-overlay">
      <div class="loading-card">
        <img src="/icon.svg" class="loading-icon" alt="" />
        <h2 class="loading-app-name">X-ReaderPlus</h2>
        <template v-if="!initError">
          <p class="loading-step">{{ bookshelf.loadingMessage }}</p>
          <v-progress-linear
            :model-value="bookshelf.loadingProgress"
            color="primary"
            height="4"
            rounded
            class="loading-bar"
          />
          <p class="loading-pct">{{ bookshelf.loadingProgress }}%</p>
        </template>
        <template v-else>
          <v-icon size="48" color="error" class="my-3">mdi-alert-circle-outline</v-icon>
          <p class="text-error text-body-2 mb-2">初始化失败</p>
          <p class="text-caption text-medium-emphasis mb-3">{{ initError }}</p>
          <v-btn color="primary" variant="tonal" size="small" @click="reinit">重试</v-btn>
        </template>
      </div>
    </div>

    <!-- ========== Main App (revealed after loading) ========== -->
    <template v-if="booksLoaded">
    <!-- Title bar -->
    <div v-if="isElectron" class="title-bar">
      <div class="title-bar-left">
        <img src="/icon.svg" width="18" height="18" class="title-icon" alt="" />
        <span>X-ReaderPlus</span>
        <span class="title-bar-subtitle">{{ t('app.subtitle') }}</span>
      </div>
      <div class="title-bar-right">
        <v-tooltip text="切换主题 (Ctrl+T)" location="bottom">
          <template #activator="{ props }"><button v-bind="props" class="title-bar-btn" @click="themeStore.toggle"><v-icon size="16">{{ themeIcon }}</v-icon></button></template>
        </v-tooltip>
        <v-tooltip text="最小化" location="bottom">
          <template #activator="{ props }"><button v-bind="props" class="title-bar-btn" @click="windowMinimize"><v-icon size="16">mdi-window-minimize</v-icon></button></template>
        </v-tooltip>
        <v-tooltip text="最大化" location="bottom">
          <template #activator="{ props }"><button v-bind="props" class="title-bar-btn" @click="windowMaximize"><v-icon size="16">mdi-window-maximize</v-icon></button></template>
        </v-tooltip>
        <v-tooltip text="关闭" location="bottom">
          <template #activator="{ props }"><button v-bind="props" class="title-bar-btn close" @click="windowClose"><v-icon size="16">mdi-close</v-icon></button></template>
        </v-tooltip>
      </div>
    </div>

    <!-- Global progress bar -->
    <v-progress-linear v-if="appProgress.isLoading.value" indeterminate color="primary" height="2" class="global-progress-bar" />

    <div class="app-body">
      <!-- Library sidebar -->
      <div v-if="showSidebar" class="nav-sidebar" :style="{ width: navCollapsed ? '56px' : '220px' }" :class="{ collapsed: navCollapsed }">
        <div class="nav-brand" @click="router.push('/')">
          <img src="/icon.svg" width="28" height="28" alt="" />
          <span v-if="!navCollapsed" class="nav-brand-text">X-ReaderPlus</span>
        </div>

        <!-- Library selector -->
        <div class="nav-section" v-if="!navCollapsed">
          <div class="nav-section-title">{{ t('nav.library') }}</div>
          <v-select
            :model-value="bookshelf.activeLibraryId"
            :items="libItems"
            item-title="text"
            item-value="value"
            density="compact"
            variant="outlined"
            hide-details
            class="lib-select ma-2"
            @update:model-value="bookshelf.setActiveLibrary($event as string)"
          />
          <div class="d-flex gap-1 px-2 mb-2">
            <v-btn size="x-small" variant="text" prepend-icon="mdi-plus" block @click="showNewLibDialog = true">{{ t('library.newLibrary') }}</v-btn>
          </div>
        </div>
        <v-divider v-if="!navCollapsed" class="mx-2" />

        <!-- Nav items -->
        <div class="nav-items">
          <v-tooltip v-for="item in navItems" :key="item.to" :text="item.label" location="right" :disabled="!navCollapsed">
            <template #activator="{ props: tp }">
              <div v-bind="tp" class="nav-item" :class="{ active: isActive(item.to) }" @click="router.push(item.to)">
                <v-icon size="22">{{ item.icon }}</v-icon>
                <span v-if="!navCollapsed" class="nav-label">{{ item.label }}</span>
              </div>
            </template>
          </v-tooltip>
        </div>

        <v-spacer />

        <v-tooltip :text="navCollapsed ? '展开菜单' : '收起菜单'" location="right">
          <template #activator="{ props: tp }">
            <div v-bind="tp" class="nav-item nav-collapse" @click="navCollapsed = !navCollapsed">
              <v-icon size="20">{{ navCollapsed ? 'mdi-menu' : 'mdi-chevron-left' }}</v-icon>
            </div>
          </template>
        </v-tooltip>
      </div>

      <!-- Main -->
      <div class="app-content">
        <router-view v-slot="{ Component }">
          <transition name="page-fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </div>

    <!-- Command palette -->
    <v-dialog v-model="showCommandPalette" max-width="500">
      <v-card>
        <v-card-text class="pa-2">
          <v-text-field v-model="commandQuery" placeholder="输入命令搜索..." prepend-inner-icon="mdi-magnify" autofocus hide-details variant="plain" density="comfortable"
            @keyup.enter="executeCommand" @keyup.escape="showCommandPalette = false" />
        </v-card-text>
        <v-divider />
        <v-list density="compact" max-height="300">
          <v-list-item v-for="(item, idx) in filteredCommands" :key="idx" :title="item.title" :subtitle="item.subtitle" @click="executeCommandItem(item)">
            <template #prepend><v-icon size="20">{{ item.icon }}</v-icon></template>
            <template #append v-if="item.shortcut"><v-chip size="x-small" variant="flat">{{ item.shortcut }}</v-chip></template>
          </v-list-item>
        </v-list>
      </v-card>
    </v-dialog>

    <!-- New library dialog -->
    <v-dialog v-model="showNewLibDialog" max-width="400">
      <v-card>
        <v-card-title>{{ t('library.newLibrary') }}</v-card-title>
        <v-card-text>
          <v-radio-group v-model="newLibMode" inline density="compact" hide-details class="mb-3">
            <v-radio :label="t('library.copyImport')" value="copy" />
            <v-radio :label="t('library.selectFolder')" value="folder" />
          </v-radio-group>
          <v-text-field v-model="newLibName" :label="t('library.libraryName')" variant="outlined" density="compact" class="mb-2" hide-details />
          <v-btn v-if="newLibMode === 'folder'" variant="outlined" size="small" block @click="selectFolder" class="mt-2">
            <v-icon size="16" class="mr-1">mdi-folder-open</v-icon> {{ t('library.selectFolder') }}
          </v-btn>
          <p v-if="selectedFolderPath" class="text-caption mt-1">{{ selectedFolderPath }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer /><v-btn variant="text" @click="showNewLibDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" @click="createNewLibrary" :disabled="!newLibName.trim()">{{ t('library.createLibrary') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    </template>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { logger } from '@/services/log'
import { useThemeStore } from '@/stores/theme'
import { useBookshelfStore } from '@/stores/bookshelf'
import { db } from '@/services/db'
import { createSampleBook, createSampleChapters } from '@/services/sample-data'
import { upsertMeta, getMetaCount } from '@/services/metadata'
import { DEFAULT_LIBRARY_ID } from '@/constants'
import { useAppProgress } from '@/composables/useProgress'

const { t } = useI18n()
const themeStore = useThemeStore()
const bookshelf = useBookshelfStore()
const router = useRouter()
const appProgress = useAppProgress()
const route = useRoute()

const isElectron = computed(() => typeof window !== 'undefined' && !!window.electronAPI && !(window as any).__xr_native_titlebar)
const booksLoaded = ref(false)
const initError = ref('')
async function reinit() {
  initError.value = ''
  try {
    await bookshelf.loadLibraries()
    await bookshelf.loadBookCount()
    await initSample()
    await bookshelf.loadBooks()
    booksLoaded.value = true
  } catch (e: any) { initError.value = e.message || '未知错误' }
}
const showCommandPalette = ref(false)
let unsubTheme: (() => void) | null = null
let unsubPalette: (() => void) | null = null
const commandQuery = ref('')
const navCollapsed = ref(false)
const showSidebar = computed(() => route.name !== 'unlock')
const showNewLibDialog = ref(false)
const newLibMode = ref<'copy' | 'folder'>('copy')
const newLibName = ref('')
const selectedFolderPath = ref('')

const themeIcon = computed(() => themeStore.current === 'dark' ? 'mdi-weather-night' : themeStore.current === 'sepia' ? 'mdi-palette' : 'mdi-white-balance-sunny')

const libItems = computed(() => [
  { text: '📚 全部书籍 (' + bookshelf.books.length + ')', value: '__all__' },
  ...bookshelf.libraries.map(l => ({ text: l.name + (l.id === DEFAULT_LIBRARY_ID ? '' : ` (${l.bookCount})`), value: l.id }))
])

const navItems = computed(() => [
  { label: t('nav.bookshelf'), icon: 'mdi-bookshelf', to: '/' },
  { label: t('nav.library'), icon: 'mdi-folder-multiple', to: '/libraries' },
  { label: t('nav.notes'), icon: 'mdi-note-edit-outline', to: '/notes' },
  { label: t('nav.tags'), icon: 'mdi-tag-multiple', to: '/tags' },
  { label: t('nav.dictionary'), icon: 'mdi-book-search', to: '/dictionary' },
  { label: t('nav.stats'), icon: 'mdi-chart-bar', to: '/stats' },
  { label: t('nav.history'), icon: 'mdi-history', to: '/history' },
  { label: t('nav.trash'), icon: 'mdi-delete-outline', to: '/trash' },
  { label: t('nav.settings'), icon: 'mdi-cog', to: '/settings' },
])

const commands = [
  { title: t('nav.bookshelf'), subtitle: '返回书架首页', icon: 'mdi-bookshelf', route: '/' },
  { title: '书库管理', subtitle: '管理所有书库', icon: 'mdi-folder-multiple', route: '/libraries' },
  { title: t('nav.notes'), subtitle: '查看所有标注', icon: 'mdi-note-edit-outline', route: '/notes' },
  { title: t('nav.settings'), subtitle: '偏好设置', icon: 'mdi-cog', route: '/settings' },
  { title: t('nav.stats'), subtitle: '阅读统计', icon: 'mdi-chart-bar', route: '/stats' },
  { title: '切换主题', subtitle: '明亮/暗黑/护眼', icon: 'mdi-theme-light-dark', action: 'toggleTheme', shortcut: 'Ctrl+T' },
  { title: t('library.newLibrary'), subtitle: '创建书库管理书籍', icon: 'mdi-bookshelf-plus', action: 'newLibrary' },
]

const filteredCommands = computed(() => {
  const q = commandQuery.value.toLowerCase()
  return q ? commands.filter(c => c.title.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q)) : commands
})

function isActive(to: string) { return to === '/' ? route.path === '/' : route.path.startsWith(to) }
function executeCommand() { if (filteredCommands.value.length > 0) executeCommandItem(filteredCommands.value[0]) }
function executeCommandItem(item: any) {
  showCommandPalette.value = false; commandQuery.value = ''
  if (item.route) router.push(item.route)
  else if (item.action === 'toggleTheme') themeStore.toggle()
  else if (item.action === 'newLibrary') showNewLibDialog.value = true
}

function windowMinimize() { window.electronAPI?.minimize() }
function windowMaximize() { window.electronAPI?.maximize() }
function windowClose() { window.electronAPI?.close() }

async function selectFolder() {
  if (window.electronAPI?.openFolder) {
    const result = await window.electronAPI.openFolder()
    if (!result.canceled && result.folderPath) {
      selectedFolderPath.value = result.folderPath
    }
  }
}

async function createNewLibrary() {
  const name = newLibName.value.trim()
  if (!name) return
  if (newLibMode.value === 'folder' && selectedFolderPath.value) {
    await bookshelf.createLibrary(name, selectedFolderPath.value)
  } else {
    await bookshelf.createLibrary(name, '')
  }
  showNewLibDialog.value = false
  newLibName.value = ''
  selectedFolderPath.value = ''
}

async function insertBookLib(book: import('@/types').Book) {
  // Pass full book object to match preload signature (single arg)
  if (window.electronAPI?.books?.insert) {
    return window.electronAPI.books.insert(book)
  }
  return db.lib.put({ id: book.id, data: JSON.stringify(book) })
}

async function insertChapters(bookId: string, ch: ReturnType<typeof createSampleChapters>) {
  const data = JSON.stringify(ch)
  if (window.electronAPI?.chapters?.set) {
    return window.electronAPI.chapters.set(bookId, data)
  }
  return db.ch.put({ bid: bookId, data })
}

async function initSample() {
  try {
    const count = await getMetaCount()
    if (count === 0) {
      logger.info('初始化用户指南...')
      const book = createSampleBook()
      const ch = createSampleChapters()
      await insertBookLib(book)
      await insertChapters(book.id, ch)
      await upsertMeta(book)
      logger.info('用户指南初始化完成')
    }
  } catch (e) {
    logger.warn('初始化用户指南失败（不影响正常使用）', e)
  }
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.ctrlKey && e.key === 'k') { e.preventDefault(); showCommandPalette.value = !showCommandPalette.value }
  if (e.ctrlKey && e.key === 't') { e.preventDefault(); themeStore.toggle() }
}

onMounted(async () => {
  appProgress.setLoading(true, '正在初始化...')
  try {
    await themeStore.load()
    appProgress.setLoading(true, '正在加载书库...')
    await bookshelf.loadLibraries()
    await bookshelf.loadBookCount()
    appProgress.setLoading(true, '正在加载样例...')
    await initSample()
    // Ensure sample book is loaded into the store immediately
    await bookshelf.loadBooks()
  } finally {
    booksLoaded.value = true
    appProgress.setLoading(false)
  }
  if (isElectron.value) {
    try {
      const themeListener = await window.electronAPI?.onToggleTheme(() => themeStore.toggle())
      if (themeListener) unsubTheme = themeListener
    } catch { }
    try {
      const paletteListener = await window.electronAPI?.onCommandPalette(() => showCommandPalette.value = !showCommandPalette.value)
      if (paletteListener) unsubPalette = paletteListener
    } catch { }
  }
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  if (typeof unsubTheme === 'function') unsubTheme()
  if (typeof unsubPalette === 'function') unsubPalette()
})
</script>

<style scoped>
.app-body { display: flex; height: calc(100vh - 36px); overflow: hidden; }
/* :global() needed because body is outside the component scope */
:global(body:not(:has(.title-bar))) .app-body { height: 100vh; }

.nav-sidebar { height: 100%; background: rgb(var(--v-theme-surface)); border-right: 1px solid rgba(var(--v-theme-on-surface), 0.08); display: flex; flex-direction: column; flex-shrink: 0; transition: width 0.2s ease; overflow: hidden; }

.nav-brand { display: flex; align-items: center; gap: 10px; padding: 16px; cursor: pointer; border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.06); }
.nav-brand-text { font-size: 15px; font-weight: 700; white-space: nowrap; }

.nav-section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; padding: 8px 16px 4px; opacity: 0.5; letter-spacing: 0.5px; }

.nav-items { padding: 4px 8px; display: flex; flex-direction: column; gap: 1px; flex: 1; }
.nav-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 8px; cursor: pointer; color: rgb(var(--v-theme-on-surface)); opacity: 0.7; transition: all 0.15s; white-space: nowrap; }
.nav-item:hover { background: rgba(var(--v-theme-on-surface), 0.06); opacity: 1; }
.nav-item.active { background: rgb(var(--v-theme-primary)); color: rgb(var(--v-theme-on-primary)); opacity: 1; font-weight: 600; }
.nav-label { font-size: 14px; }
.nav-collapse { margin: 8px; justify-content: center; opacity: 0.5; }

.lib-select { font-size: 12px; }

.title-bar { -webkit-app-region: drag; height: 36px; display: flex; align-items: center; justify-content: space-between; padding: 0 8px; background: rgb(var(--v-theme-surface)); border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.06); flex-shrink: 0; }
.title-bar-left { display: flex; align-items: center; gap: 8px; padding-left: 8px; font-size: 13px; font-weight: 600; }
.title-icon { width: 18px; height: 18px; }
.title-bar-subtitle { font-size: 10px; font-weight: 400; opacity: 0.45; margin-left: 4px; }
.title-bar-right { -webkit-app-region: no-drag; display: flex; align-items: center; gap: 2px; }
.title-bar-btn { width: 36px; height: 28px; border: none; background: transparent; color: rgb(var(--v-theme-on-surface)); cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 4px; font-size: 16px; opacity: 0.7; }
.title-bar-btn:hover { background: rgba(var(--v-theme-on-surface), 0.08); opacity: 1; }
.title-bar-btn.close:hover { background: #E81123; color: #fff; opacity: 1; }

.app-content { flex: 1; overflow: hidden; display: flex; flex-direction: column; background: rgb(var(--v-theme-background)); }
.gap-1 { gap: 4px; }
.global-progress-bar { flex-shrink: 0; }

/* ========== Startup Loading Screen ========== */
.loading-overlay {
  position: fixed; inset: 0; z-index: 9999;
  display: flex; align-items: center; justify-content: center;
  background: rgb(var(--v-theme-background));
}
.loading-card {
  text-align: center;
  width: 320px;
  padding: 40px 32px;
  border-radius: 16px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 4px 24px rgba(0,0,0,0.12);
}
.loading-icon {
  width: 64px; height: 64px;
  margin-bottom: 12px;
  animation: loading-pulse 1.6s ease-in-out infinite;
}
@keyframes loading-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(0.95); }
}
.loading-app-name {
  font-size: 20px; font-weight: 700;
  margin: 0 0 16px 0;
  color: rgb(var(--v-theme-on-surface));
}
.loading-step {
  font-size: 13px; opacity: 0.65;
  margin: 0 0 16px 0;
  color: rgb(var(--v-theme-on-surface));
}
.loading-bar {
  margin-bottom: 8px;
}
.loading-pct {
  font-size: 12px; opacity: 0.45;
  margin: 0;
  color: rgb(var(--v-theme-on-surface));
}
</style>

<style>
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.12s ease;
}
.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}
</style>
