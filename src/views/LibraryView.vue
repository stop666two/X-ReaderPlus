<template>
  <div class="library-view">
    <div class="library-header">
      <div>
        <h2 class="library-title">书库管理</h2>
        <p class="text-caption text-medium-emphasis mt-1">
          {{ libraries.length }} 个书库 · {{ totalBooks }} 本书 ·
          {{ totalReadingHours }} 小时阅读
        </p>
      </div>
      <div class="d-flex ga-2">
        <v-btn variant="tonal" prepend-icon="mdi-refresh" @click="refresh">刷新</v-btn>
        <v-btn color="primary" prepend-icon="mdi-plus" @click="showCreateDialog = true">新建书库</v-btn>
      </div>
    </div>

    <v-text-field
      v-model="searchQuery"
      prepend-inner-icon="mdi-magnify"
      placeholder="搜索书库..."
      variant="outlined"
      density="compact"
      hide-details
      clearable
      class="mt-4"
    />

    <div v-if="filteredLibraries.length === 0" class="empty-state">
      <v-icon size="64" color="grey-lighten-1">mdi-bookshelf</v-icon>
      <p class="text-body-1 mt-3">没有匹配的书库</p>
      <p class="text-caption text-medium-emphasis mt-1">尝试修改搜索条件或创建新书库</p>
    </div>

    <v-row v-else class="mt-4" dense>
      <v-col
        v-for="lib in pagedLibraries"
        :key="lib.id"
        cols="12" sm="6" xl="4"
      >
        <v-card
          variant="outlined"
          class="lib-card"
          :class="{ 'lib-card-default': lib.id === 'default' }"
        >
          <div class="lib-card-body">
            <div class="lib-card-top">
              <div class="lib-icon-wrap" :class="lib.id === 'default' ? 'lib-icon-default' : 'lib-icon-normal'">
                <v-icon size="28">
                  {{ lib.mode === 'folder' ? 'mdi-folder-outline' : 'mdi-content-copy' }}
                </v-icon>
              </div>
              <div class="lib-info">
                <template v-if="editingId === lib.id">
                  <v-text-field
                    v-model="editName" density="compact" variant="outlined"
                    hide-details class="edit-name-field"
                    @keyup.enter="saveRename(lib.id)" @keyup.escape="cancelEdit"
                    autofocus
                  />
                </template>
                <template v-else>
                  <div class="d-flex align-center ga-2 flex-wrap">
                    <span class="lib-name">{{ lib.name }}</span>
                    <v-chip v-if="lib.id === 'default'" size="x-small" variant="flat" color="grey">默认</v-chip>
                    <v-chip
                      v-if="lockedLibs.has(lib.id)" size="x-small"
                      variant="flat" color="warning" prepend-icon="mdi-lock"
                    >已锁定</v-chip>
                  </div>
                </template>
              </div>
            </div>

            <div class="lib-stats">
              <div class="stat-item">
                <span class="stat-value">{{ lib.bookCount }}</span>
                <span class="stat-label">书籍</span>
              </div>
              <div class="stat-divider" />
              <div class="stat-item">
                <span class="stat-value">{{ formatFiles(lib) }}</span>
                <span class="stat-label">格式</span>
              </div>
              <div class="stat-divider" />
              <div class="stat-item">
                <span class="stat-value">{{ formatHours(lib) }}</span>
                <span class="stat-label">小时</span>
              </div>
              <div class="stat-divider" />
              <div class="stat-item">
                <span class="stat-value">{{ formatPercent(lib) }}</span>
                <span class="stat-label">进度</span>
              </div>
            </div>

            <div class="lib-tags" v-if="getLibraryTags(lib.id).length > 0">
              <v-chip
                v-for="tag in getLibraryTags(lib.id).slice(0, 6)"
                :key="tag.name"
                size="x-small"
                variant="tonal"
                density="compact"
                class="tag-chip"
              >
                {{ tag.name }}
                <span class="tag-count">({{ tag.count }})</span>
              </v-chip>
              <span v-if="getLibraryTags(lib.id).length > 6" class="text-caption text-medium-emphasis ml-1">
                +{{ getLibraryTags(lib.id).length - 6 }}
              </span>
            </div>

            <div class="lib-created text-caption text-medium-emphasis">
              <v-icon size="12" class="mr-1">mdi-calendar</v-icon>
              {{ formatDate(lib.createdAt) }}
              <template v-if="lib.mode === 'folder'">
                <v-icon size="12" class="mx-1">mdi-circle-small</v-icon>
                文件夹链接
              </template>
            </div>
          </div>

          <v-divider />

          <div class="lib-card-actions">
            <v-tooltip text="查看书库" location="top">
              <template #activator="{ props }">
                <v-btn v-bind="props" size="small" variant="text" icon="mdi-magnify" @click="viewLibrary(lib.id)" />
              </template>
            </v-tooltip>
            <v-tooltip v-if="lib.id !== 'default'" text="重命名" location="top">
              <template #activator="{ props }">
                <v-btn v-bind="props" size="small" variant="text" icon="mdi-pencil" :disabled="editingId === lib.id" @click="startRename(lib)" />
              </template>
            </v-tooltip>
            <v-tooltip :text="lockedLibs.has(lib.id) ? '解锁' : '设置隐私锁'" location="top">
              <template #activator="{ props }">
                <v-btn v-bind="props" size="small" variant="text" :icon="lockedLibs.has(lib.id) ? 'mdi-lock-open-variant' : 'mdi-shield-lock-outline'" @click="openPrivacyDialog(lib.id)" />
              </template>
            </v-tooltip>
            <v-spacer />
            <v-tooltip text="导出书库" location="top">
              <template #activator="{ props }">
                <v-btn v-bind="props" v-if="lib.id !== 'default'" size="small" variant="text" icon="mdi-export" @click="exportLibrary(lib.id)" />
              </template>
            </v-tooltip>
            <v-tooltip text="导入到该书库" location="top">
              <template #activator="{ props }">
                <v-btn v-bind="props" size="small" variant="text" icon="mdi-file-import-outline" @click="importToLibrary(lib)" />
              </template>
            </v-tooltip>
            <v-tooltip text="删除书库" location="top">
              <template #activator="{ props }">
                <v-btn v-bind="props" v-if="lib.id !== 'default'" size="small" variant="text" icon="mdi-delete-outline" color="error" @click="confirmDelete(lib)" />
              </template>
            </v-tooltip>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <div v-if="totalPages > 1" class="pagination-bar">
      <v-pagination
        v-model="currentPage"
        :length="totalPages"
        :total-visible="7"
        density="comfortable"
        size="small"
      />
      <span class="text-caption text-medium-emphasis ml-3">
        {{ filteredLibraries.length }} 个书库
      </span>
    </div>

    <v-dialog v-model="showCreateDialog" max-width="420">
      <v-card>
        <v-toolbar density="compact" color="surface">
          <v-toolbar-title>新建书库</v-toolbar-title>
          <v-spacer />
          <v-btn icon="mdi-close" size="small" variant="text" @click="showCreateDialog = false" />
        </v-toolbar>
        <v-card-text class="pt-4">
          <v-text-field v-model="newName" label="书库名称" variant="outlined" density="compact" placeholder="输入书库名称..." :rules="[v => !!v || '名称不能为空']" autofocus />
          <v-select v-model="newMode" :items="modeOptions" item-title="label" item-value="value" label="导入模式" variant="outlined" density="compact" class="mt-2" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showCreateDialog = false">取消</v-btn>
          <v-btn color="primary" :disabled="!newName.trim()" :loading="creating" @click="createLibrary">创建</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showDeleteDialog" max-width="400">
      <v-card>
        <v-card-title class="text-error">
          <v-icon color="error" class="mr-2">mdi-alert-circle</v-icon>
          删除书库
        </v-card-title>
        <v-card-text>
          <p>确定要删除「{{ deletingLib?.name }}」吗？</p>
          <p class="text-caption text-medium-emphasis mt-2">
            书库中的 {{ deletingLib?.bookCount || 0 }} 本书将移入默认书库，数据不会丢失。
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showDeleteDialog = false">取消</v-btn>
          <v-btn color="error" variant="tonal" :loading="deleting" @click="doDelete">删除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showPrivacyDialog" max-width="420">
      <v-card>
        <v-toolbar density="compact" color="surface">
          <v-toolbar-title>{{ lockedLibs.has(privacyTargetId) ? '解锁书库' : '加密书库' }}</v-toolbar-title>
          <v-spacer />
          <v-btn icon="mdi-close" size="small" variant="text" @click="showPrivacyDialog = false" />
        </v-toolbar>
        <v-card-text class="pt-4">
          <p class="text-caption text-medium-emphasis mb-3">
            {{ lockedLibs.has(privacyTargetId) ? '输入密码解锁该书库，解密所有章节内容。' : '设置密码以加密该书库中所有书籍的章节内容，需要密码才能阅读。' }}
          </p>
          <v-text-field v-model="privacyPassword" label="密码" type="password" variant="outlined" density="compact" />
          <v-text-field v-if="!lockedLibs.has(privacyTargetId)" v-model="privacyPassword2" label="确认密码" type="password" variant="outlined" density="compact" class="mt-2" />
          <p v-if="pwdError" class="text-caption text-error mt-1">{{ pwdError }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showPrivacyDialog = false">取消</v-btn>
          <v-btn color="primary" :loading="privacyLoading" @click="doPrivacyAction">
            {{ lockedLibs.has(privacyTargetId) ? '解锁' : '加密' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useBookshelfStore } from '@/stores/bookshelf'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import type { Library } from '@/types'

const bookshelf = useBookshelfStore()
const router = useRouter()
const searchQuery = ref('')

const PAGE_SIZE = 6

const libraries = computed(() => bookshelf.libraries)
const totalBooks = computed(() => bookshelf.books.length)
const totalReadingHours = computed(() => {
  const total = bookshelf.books.reduce((sum, b) => sum + (b.totalReadingTime || 0), 0)
  return Math.round(total / 3600000)
})

const filteredLibraries = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q) return libraries.value
  return libraries.value.filter(l =>
    l.name.toLowerCase().includes(q) ||
    l.mode.toLowerCase().includes(q)
  )
})

const currentPage = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(filteredLibraries.value.length / PAGE_SIZE)))

const pagedLibraries = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredLibraries.value.slice(start, start + PAGE_SIZE)
})

watch(filteredLibraries, () => {
  if (currentPage.value > totalPages.value) {
    currentPage.value = Math.max(1, totalPages.value)
  }
})

const showCreateDialog = ref(false)
const creating = ref(false)
const newName = ref('')
const newMode = ref<'copy' | 'folder'>('copy')
const modeOptions = [
  { label: '复制导入（推荐）', value: 'copy' },
  { label: '文件夹链接', value: 'folder' }
]

const editingId = ref('')
const editName = ref('')

const showDeleteDialog = ref(false)
const deleting = ref(false)
const deletingLib = ref<Library | null>(null)

const showPrivacyDialog = ref(false)
const privacyTargetId = ref('')
const privacyPassword = ref('')
const privacyPassword2 = ref('')
const privacyLoading = ref(false)
const pwdError = ref('')
const lockedLibs = ref<Set<string>>(new Set())

const tagCache = ref<Map<string, Array<{ name: string; count: number }>>>(new Map())

function buildTagCache() {
  const cache = new Map<string, Array<{ name: string; count: number }>>()
  for (const lib of libraries.value) {
    const libBooks = bookshelf.books.filter(b => b.libraryId === lib.id)
    const tagMap = new Map<string, number>()
    for (const b of libBooks) {
      for (const tag of b.tags) {
        tagMap.set(tag, (tagMap.get(tag) || 0) + 1)
      }
    }
    const entries = Array.from(tagMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
    cache.set(lib.id, entries)
  }
  tagCache.value = cache
}

function getLibraryTags(libId: string) {
  return tagCache.value.get(libId) || []
}

function formatDate(ts: number): string {
  if (!ts) return '未知'
  return dayjs(ts).format('YYYY-MM-DD')
}

function formatFiles(lib: Library): string {
  const fmts = new Set(bookshelf.books.filter(b => b.libraryId === lib.id).map(b => b.format))
  return `${fmts.size}`
}

function formatHours(lib: Library): string {
  const total = bookshelf.books
    .filter(b => b.libraryId === lib.id)
    .reduce((sum, b) => sum + (b.totalReadingTime || 0), 0)
  return Math.round(total / 3600000).toString()
}

function formatPercent(lib: Library): string {
  const libBooks = bookshelf.books.filter(b => b.libraryId === lib.id)
  if (libBooks.length === 0) return '—'
  const avg = libBooks.reduce((s, b) => s + (b.progress || 0), 0) / libBooks.length
  return `${Math.round(avg * 100)}%`
}

function viewLibrary(id: string) {
  bookshelf.activeLibraryId = id
  router.push('/')
}

function startRename(lib: Library) {
  editingId.value = lib.id
  editName.value = lib.name
}

async function saveRename(id: string) {
  if (editName.value.trim()) {
    await bookshelf.renameLibrary(id, editName.value.trim())
  }
  cancelEdit()
}

function cancelEdit() {
  editingId.value = ''
  editName.value = ''
}

async function createLibrary() {
  if (!newName.value.trim()) return
  creating.value = true
  try {
    await bookshelf.createLibrary(newName.value.trim(), newMode.value)
    showCreateDialog.value = false
    newName.value = ''
  } finally {
    creating.value = false
  }
}

function confirmDelete(lib: Library) {
  deletingLib.value = lib
  showDeleteDialog.value = true
}

async function doDelete() {
  if (!deletingLib.value) return
  deleting.value = true
  try {
    await bookshelf.deleteLibrary(deletingLib.value.id)
    showDeleteDialog.value = false
    deletingLib.value = null
  } finally {
    deleting.value = false
  }
}

function openPrivacyDialog(libId: string) {
  privacyTargetId.value = libId
  privacyPassword.value = ''
  privacyPassword2.value = ''
  pwdError.value = ''
  showPrivacyDialog.value = true
}

async function doPrivacyAction() {
  const libId = privacyTargetId.value
  const pwd = privacyPassword.value
  pwdError.value = ''
  if (lockedLibs.value.has(libId)) {
    privacyLoading.value = true
    try {
      const { verifyLibraryLock } = await import('@/services/privacy-lock')
      const ok = await verifyLibraryLock(libId, pwd)
      if (ok) {
        lockedLibs.value.delete(libId)
        showPrivacyDialog.value = false
      } else {
        pwdError.value = '密码错误'
      }
    } catch (e: any) {
      pwdError.value = e?.message || '验证失败'
    }
    privacyLoading.value = false
  } else {
    if (!pwd || pwd.length < 8) { pwdError.value = '密码至少需要8个字符'; return }
    if (pwd !== privacyPassword2.value) { pwdError.value = '两次密码输入不一致'; return }
    privacyLoading.value = true
    try {
      const { setLibraryLock } = await import('@/services/privacy-lock')
      await setLibraryLock(libId, pwd)
      lockedLibs.value.add(libId)
      showPrivacyDialog.value = false
    } catch (e: any) {
      pwdError.value = e?.message || '加密失败'
    }
    privacyLoading.value = false
  }
}

async function exportLibrary(libId: string) {
  const lib = libraries.value.find(l => l.id === libId)
  if (!lib) return
  const libBooks = bookshelf.books.filter(b => b.libraryId === libId)
  const data = JSON.stringify({ library: lib, books: libBooks }, null, 2)
  try {
    const encoder = new TextEncoder()
    const bytes = encoder.encode(data)
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    await window.electronAPI.saveFile({ defaultPath: `${lib.name}.json`, data: bin, type: 'application/json' })
  } catch (e) {
    console.warn('[LibraryView] export failed', e)
  }
}

function importToLibrary(lib: Library) {
  bookshelf.activeLibraryId = lib.id
  router.push('/')
}

async function refresh() {
  await bookshelf.loadLibraries()
  if (bookshelf.books.length === 0) await bookshelf.loadBooks()
  buildTagCache()
}

watch([() => bookshelf.libraries, () => bookshelf.books.length, () => bookshelf.totalBookCount], () => {
  lockedLibs.value = new Set()
  buildTagCache()
}, { deep: true })

onMounted(refresh)
</script>

<style scoped>
.library-view {
  padding: 32px;
  max-width: 1400px;
  margin: 0 auto;
  height: 100%;
  overflow-y: auto;
}
.library-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.library-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 0;
}
.lib-card {
  border-radius: 14px !important;
  transition: box-shadow .2s, transform .2s;
  display: flex;
  flex-direction: column;
}
.lib-card:hover {
  box-shadow: 0 4px 24px rgba(0,0,0,.08);
  transform: translateY(-2px);
}
.lib-card-default {
  border-color: rgb(var(--v-theme-primary)) !important;
  border-width: 2px !important;
}
.lib-card-body {
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.lib-card-top {
  display: flex;
  align-items: center;
  gap: 14px;
}
.lib-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.lib-icon-normal {
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
}
.lib-icon-default {
  background: rgba(0,0,0,0.06);
  color: rgba(0,0,0,0.38);
}
.lib-info {
  flex: 1;
  min-width: 0;
}
.lib-name {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
}
.edit-name-field {
  max-width: 200px;
}
.lib-stats {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 10px 0;
  border-top: 1px solid rgba(0,0,0,0.06);
  border-bottom: 1px solid rgba(0,0,0,0.06);
}
.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.stat-value {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
}
.stat-label {
  font-size: 11px;
  color: rgba(0,0,0,0.45);
  text-transform: uppercase;
  letter-spacing: .5px;
}
.stat-divider {
  width: 1px;
  height: 28px;
  background: rgba(0,0,0,0.08);
}
.lib-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
.tag-chip :deep(.v-chip__content) {
  font-size: 11px;
}
.tag-count {
  opacity: .6;
  margin-left: 2px;
}
.lib-created {
  display: flex;
  align-items: center;
}
.lib-card-actions {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  gap: 2px;
}
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 0 8px;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
