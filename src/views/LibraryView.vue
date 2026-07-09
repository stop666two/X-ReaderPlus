<template>
  <div class="library-view">
    <div class="library-header">
      <div>
        <h2 class="library-title">书库管理</h2>
        <p class="text-caption text-medium-emphasis mt-1">共 {{ libraries.length }} 个书库 · {{ totalBooks }} 本书</p>
      </div>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="showCreateDialog = true">新建书库</v-btn>
    </div>

    <div class="library-grid mt-4">
      <v-card
        v-for="lib in libraries"
        :key="lib.id"
        variant="outlined"
        class="lib-card"
        :class="{ 'lib-card-default': lib.id === 'default' }"
      >
        <div class="lib-card-header">
          <v-avatar :color="lib.id === 'default' ? 'grey-lighten-2' : 'primary'" size="44" rounded>
            <v-icon :color="lib.id === 'default' ? 'grey' : 'white'">
              {{ lib.mode === 'folder' ? 'mdi-folder' : 'mdi-content-copy' }}
            </v-icon>
          </v-avatar>
          <div class="lib-card-info">
            <div class="d-flex align-center gap-2">
              <template v-if="editingId === lib.id">
                <v-text-field v-model="editName" density="compact" variant="outlined" hide-details class="edit-name-field" @keyup.enter="saveRename(lib.id)" @keyup.escape="cancelEdit" />
              </template>
              <template v-else>
                <span class="lib-name">{{ lib.name }}</span>
                <v-chip v-if="lib.id === 'default'" size="x-small" variant="flat" color="grey">默认</v-chip>
                <v-chip v-if="lockedLibs.has(lib.id)" size="x-small" variant="flat" color="warning" prepend-icon="mdi-lock">已锁定</v-chip>
              </template>
            </div>
            <div class="text-caption text-medium-emphasis mt-1">
              {{ lib.bookCount }} 本书 · {{ lib.mode === 'folder' ? '文件夹链接' : '复制导入' }}
            </div>
          </div>
        </div>

        <v-divider />

        <div class="lib-card-stats">
          <div class="stat-item">
            <span class="stat-value">{{ lib.bookCount }}</span>
            <span class="stat-label">书籍</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ formatDate(lib.createdAt) }}</span>
            <span class="stat-label">创建日期</span>
          </div>
          <div class="stat-item">
            <v-chip size="x-small" :color="lib.mode === 'folder' ? 'info' : 'success'" variant="tonal">
              {{ lib.mode === 'folder' ? '链接' : '副本' }}
            </v-chip>
          </div>
        </div>

        <v-divider />

        <div class="lib-card-actions">
          <v-btn v-if="editingId !== lib.id" size="small" variant="text" icon="mdi-magnify" @click="viewLibrary(lib.id)" title="查看书库" />
          <v-btn v-if="lib.id !== 'default' && editingId !== lib.id" size="small" variant="text" icon="mdi-pencil" @click="startRename(lib)" title="重命名" />
          <v-btn size="small" variant="text" :icon="lockedLibs.has(lib.id) ? 'mdi-lock-open-variant' : 'mdi-shield-lock-outline'" @click="openPrivacyDialog(lib.id)" :title="lockedLibs.has(lib.id) ? '解锁' : '加密'" />
          <v-spacer />
          <v-btn v-if="lib.id !== 'default' && editingId !== lib.id" size="small" variant="text" icon="mdi-export" @click="exportLibrary(lib.id)" title="导出书库" />
          <v-btn v-if="lib.id !== 'default' && editingId !== lib.id" size="small" variant="text" icon="mdi-delete-outline" color="error" @click="confirmDelete(lib)" title="删除书库" />
        </div>
      </v-card>
    </div>

    <div v-if="libraries.length === 0 && bookshelf.books.length > 0" class="text-center py-8 text-medium-emphasis">
      <v-icon size="48" color="grey">mdi-bookshelf</v-icon>
      <p class="mt-2">暂无书库，点击上方按钮创建</p>
    </div>
    <div v-if="libraries.length === 0 && bookshelf.books.length === 0" class="text-center py-8">
      <v-progress-circular indeterminate size="24" class="mb-2" />
      <p class="text-medium-emphasis">加载中...</p>
    </div>

    <!-- Create Dialog -->
    <v-dialog v-model="showCreateDialog" max-width="420">
      <v-card><v-card-title>新建书库</v-card-title>
        <v-card-text>
          <v-text-field v-model="newName" label="书库名称" variant="outlined" density="compact" placeholder="输入书库名称" :rules="[v => !!v || '名称不能为空']" />
          <v-select v-model="newMode" :items="modeOptions" item-title="label" item-value="value" label="导入模式" variant="outlined" density="compact" />
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn variant="text" @click="showCreateDialog = false">取消</v-btn><v-btn color="primary" :disabled="!newName" @click="createLibrary">创建</v-btn></v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirm -->
    <v-dialog v-model="showDeleteDialog" max-width="400">
      <v-card><v-card-title class="text-error">删除书库</v-card-title>
        <v-card-text>
          <p>确定要删除「{{ deletingLib?.name }}」吗？</p>
          <p class="text-caption text-medium-emphasis mt-1">书库中的书籍将移入默认书库。</p>
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn variant="text" @click="showDeleteDialog = false">取消</v-btn><v-btn color="error" variant="tonal" @click="doDelete">删除</v-btn></v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Privacy Dialog -->
    <v-dialog v-model="showPrivacyDialog" max-width="420">
      <v-card><v-card-title>{{ lockedLibs.has(privacyTargetId) ? '解锁书库' : '加密书库' }}</v-card-title>
        <v-card-text>
          <p class="text-caption text-medium-emphasis mb-2">{{ lockedLibs.has(privacyTargetId) ? '输入密码解锁该书库' : '设置密码以加密该书库中的书籍章节' }}</p>
          <v-text-field v-model="privacyPassword" label="密码" type="password" variant="outlined" density="compact" />
          <v-text-field v-if="!lockedLibs.has(privacyTargetId)" v-model="privacyPassword2" label="确认密码" type="password" variant="outlined" density="compact" />
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn variant="text" @click="showPrivacyDialog = false">取消</v-btn><v-btn color="primary" :loading="privacyLoading" @click="doPrivacyAction">{{ lockedLibs.has(privacyTargetId) ? '解锁' : '加密' }}</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useBookshelfStore } from '@/stores/bookshelf'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'

const bookshelf = useBookshelfStore()
const router = useRouter()

const libraries = computed(() => bookshelf.libraries)
const totalBooks = computed(() => bookshelf.books.length)

const showCreateDialog = ref(false)
const newName = ref('')
const newMode = ref<'copy' | 'folder'>('copy')
const modeOptions = [
  { label: '复制导入（推荐）', value: 'copy' },
  { label: '文件夹链接', value: 'folder' }
]

const editingId = ref('')
const editName = ref('')

const showDeleteDialog = ref(false)
const deletingLib = ref<any>(null)

const showPrivacyDialog = ref(false)
const privacyTargetId = ref('')
const privacyPassword = ref('')
const privacyPassword2 = ref('')
const privacyLoading = ref(false)
const lockedLibs = ref<Set<string>>(new Set())

function formatDate(ts: number): string {
  return dayjs(ts).format('YYYY-MM-DD')
}

function viewLibrary(id: string) {
  bookshelf.activeLibraryId = id
  router.push('/')
}

function startRename(lib: any) {
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
  await bookshelf.createLibrary(newName.value.trim(), newMode.value)
  showCreateDialog.value = false
  newName.value = ''
}

function confirmDelete(lib: any) {
  deletingLib.value = lib
  showDeleteDialog.value = true
}

async function doDelete() {
  if (!deletingLib.value) return
  await bookshelf.deleteLibrary(deletingLib.value.id)
  showDeleteDialog.value = false
  deletingLib.value = null
}

function openPrivacyDialog(libId: string) {
  privacyTargetId.value = libId
  privacyPassword.value = ''
  privacyPassword2.value = ''
  showPrivacyDialog.value = true
}

async function doPrivacyAction() {
  const libId = privacyTargetId.value
  const pwd = privacyPassword.value
  if (lockedLibs.value.has(libId)) {
    privacyLoading.value = true
    try {
      const { verifyLibraryLock } = await import('@/services/privacy-lock')
      const ok = await verifyLibraryLock(libId, pwd)
      if (ok) {
        lockedLibs.value.delete(libId)
        showPrivacyDialog.value = false
      }
    } catch {}
    privacyLoading.value = false
  } else {
    if (!pwd || pwd.length < 8) return
    if (pwd !== privacyPassword2.value) return
    privacyLoading.value = true
    try {
      const { setLibraryLock } = await import('@/services/privacy-lock')
      await setLibraryLock(libId, pwd)
      lockedLibs.value.add(libId)
      showPrivacyDialog.value = false
    } catch {}
    privacyLoading.value = false
  }
}

async function exportLibrary(libId: string) {
  const lib = libraries.value.find(l => l.id === libId)
  if (!lib) return
  const libBooks = bookshelf.books.filter(b => b.libraryId === libId)
  const data = JSON.stringify({ library: lib, books: libBooks }, null, 2)
  if (window.electronAPI?.saveFile) {
    const encoder = new TextEncoder()
    const bytes = encoder.encode(data)
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    await window.electronAPI.saveFile({ defaultPath: `${lib.name}.json`, data: bin, type: 'application/json' })
  }
}

onMounted(async () => {
  await bookshelf.loadLibraries()
})
</script>

<style scoped>
.library-view {
  padding: 32px;
  max-width: 960px;
  margin: 0 auto;
  height: 100%;
  overflow-y: auto;
}

.library-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.library-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
}

.library-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

.lib-card {
  width: 100%;
  overflow: hidden;
  border-radius: 12px !important;
}

.lib-card-default {
  border-color: rgb(var(--v-theme-primary)) !important;
  border-width: 2px !important;
}

.lib-card-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 20px 16px;
}

.lib-card-info {
  flex: 1;
  min-width: 0;
}

.lib-name {
  font-size: 17px;
  font-weight: 600;
}

.lib-card-stats {
  display: flex;
  gap: 32px;
  padding: 14px 20px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.stat-value {
  font-size: 15px;
  font-weight: 600;
}

.stat-label {
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.5;
}

.lib-card-actions {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  gap: 4px;
}

.edit-name-field {
  max-width: 240px;
}

.gap-2 { gap: 8px; }
</style>
