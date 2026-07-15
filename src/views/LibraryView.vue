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

    <div v-if="filteredLibraries.length === 0" class="text-center py-12 text-medium-emphasis">
      <v-icon size="56" color="grey-lighten-1">mdi-bookshelf</v-icon>
      <p class="mt-3 text-body-1">没有匹配的书库</p>
      <p class="text-caption mt-1">尝试修改搜索条件或创建新书库</p>
    </div>

    <v-row v-else class="mt-2">
      <v-col v-for="lib in filteredLibraries" :key="lib.id" cols="12" md="6" lg="4">
        <v-card
          variant="outlined"
          class="lib-card"
          :class="{ 'lib-card-default': lib.id === 'default' }"
        >
          <div class="lib-card-header">
            <div class="d-flex align-center gap-3 w-100">
              <v-avatar
                :color="lib.id === 'default' ? 'grey-lighten-2' : 'primary'"
                size="48"
                rounded
              >
                <v-icon :color="lib.id === 'default' ? 'grey' : 'white'" size="24">
                  {{ lib.mode === 'folder' ? 'mdi-folder-outline' : 'mdi-content-copy' }}
                </v-icon>
              </v-avatar>
              <div class="flex-grow-1 min-w-0">
                <template v-if="editingId === lib.id">
                  <v-text-field
                    v-model="editName" density="compact" variant="outlined"
                    hide-details class="edit-name-field"
                    @keyup.enter="saveRename(lib.id)" @keyup.escape="cancelEdit"
                    autofocus
                  />
                </template>
                <template v-else>
                  <div class="d-flex align-center ga-2">
                    <span class="lib-name text-truncate">{{ lib.name }}</span>
                    <v-chip v-if="lib.id === 'default'" size="x-small" variant="flat" color="grey">默认</v-chip>
                    <v-chip
                      v-if="lockedLibs.has(lib.id)" size="x-small"
                      variant="flat" color="warning" prepend-icon="mdi-lock"
                    >已锁定</v-chip>
                  </div>
                </template>
                <div class="text-caption text-medium-emphasis mt-1">
                  {{ lib.bookCount }} 本书
                  <v-icon size="12" class="mx-1">mdi-circle-small</v-icon>
                  {{ lib.mode === 'folder' ? '文件夹链接' : '复制导入' }}
                  <v-icon size="12" class="mx-1">mdi-circle-small</v-icon>
                  {{ formatDate(lib.createdAt) }}
                </div>
              </div>
            </div>
          </div>

          <v-divider />

          <div class="pa-3">
            <div class="d-flex justify-space-around text-center">
              <div>
                <div class="text-h6 font-weight-bold">{{ lib.bookCount }}</div>
                <div class="text-caption text-medium-emphasis">书籍</div>
              </div>
              <div>
                <div class="text-h6 font-weight-bold">{{ formatFiles(lib) }}</div>
                <div class="text-caption text-medium-emphasis">格式</div>
              </div>
              <div>
                <div class="text-h6 font-weight-bold">{{ formatHours(lib) }}</div>
                <div class="text-caption text-medium-emphasis">阅读小时</div>
              </div>
              <div>
                <div class="text-h6 font-weight-bold">{{ formatPercent(lib) }}</div>
                <div class="text-caption text-medium-emphasis">平均进度</div>
              </div>
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
}

onMounted(refresh)

watch(() => bookshelf.libraries.length, () => {
  lockedLibs.value = new Set()
})
</script>

<style scoped>
.library-view {
  padding: 32px;
  max-width: 1200px;
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
.lib-card {
  border-radius: 14px !important;
  transition: box-shadow .2s;
}
.lib-card:hover {
  box-shadow: 0 4px 20px rgba(0,0,0,.08);
}
.lib-card-default {
  border-color: rgb(var(--v-theme-primary)) !important;
  border-width: 2px !important;
}
.lib-card-header {
  padding: 18px 18px 12px;
}
.lib-card-actions {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  gap: 2px;
}
.lib-name {
  font-size: 16px;
  font-weight: 600;
}
.edit-name-field {
  max-width: 200px;
}
</style>
