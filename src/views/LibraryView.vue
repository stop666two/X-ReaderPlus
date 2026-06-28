<template>
  <div class="library-view">
    <div class="library-header">
      <h2 class="library-title">书库管理</h2>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="showCreateDialog = true">新建书库</v-btn>
    </div>

    <v-card class="mt-4" variant="outlined">
      <v-list lines="two">
        <v-list-item
          v-for="lib in libraries"
          :key="lib.id"
          class="lib-row"
        >
          <template #prepend>
            <v-icon size="32" :color="lib.id === 'default' ? 'grey' : 'primary'">
              {{ lib.mode === 'folder' ? 'mdi-folder' : 'mdi-content-copy' }}
            </v-icon>
          </template>

          <v-list-item-title class="d-flex align-center gap-2">
            <template v-if="editingId === lib.id">
              <v-text-field
                v-model="editName"
                density="compact"
                variant="outlined"
                hide-details
                class="edit-name-field"
                @keyup.enter="saveRename(lib.id)"
                @keyup.escape="cancelEdit"
                autofocus
              />
              <v-btn size="x-small" icon="mdi-check" color="success" variant="text" @click="saveRename(lib.id)" />
              <v-btn size="x-small" icon="mdi-close" variant="text" @click="cancelEdit" />
            </template>
            <template v-else>
              <span class="lib-name" :class="{ 'text-grey': lib.id === 'default' }">
                {{ lib.name }}
              </span>
              <v-chip v-if="lib.id === 'default'" size="x-small" variant="flat" color="grey">默认</v-chip>
              <v-chip
                v-if="lockedLibs.has(lib.id)"
                size="x-small"
                variant="flat"
                color="warning"
                prepend-icon="mdi-lock"
              >已锁定</v-chip>
            </template>
          </v-list-item-title>

          <v-list-item-subtitle>
            <span class="text-caption">
              {{ lib.bookCount }} 本书 · 创建于 {{ formatDate(lib.createdAt) }} · {{ lib.mode === 'folder' ? '文件夹链接' : '复制导入' }}
            </span>
          </v-list-item-subtitle>

          <template #append>
            <div class="d-flex gap-1" v-if="editingId !== lib.id">
              <v-btn
                v-if="lib.id !== 'default'"
                size="x-small"
                icon="mdi-pencil"
                variant="text"
                @click="startRename(lib)"
              />
              <v-btn
                size="x-small"
                icon="mdi-magnify"
                variant="text"
                @click="viewLibrary(lib.id)"
              />
              <v-btn
                size="x-small"
                :icon="lockedLibs.has(lib.id) ? 'mdi-lock-open-variant' : 'mdi-shield-lock-outline'"
                variant="text"
                @click="openPrivacyDialog(lib.id)"
              />
              <v-btn
                v-if="lib.id !== 'default'"
                size="x-small"
                icon="mdi-delete-outline"
                variant="text"
                color="error"
                @click="confirmDelete(lib)"
              />
            </div>
          </template>
        </v-list-item>
      </v-list>

      <v-card-text v-if="libraries.length === 0 && bookshelf.books.length > 0" class="text-center py-8">
        <v-icon size="48" color="grey">mdi-bookshelf</v-icon>
        <p class="text-grey mt-2">暂无书库，点击上方按钮创建</p>
      </v-card-text>
      <v-card-text v-if="libraries.length === 0 && bookshelf.books.length === 0" class="text-center py-8">
        <v-progress-circular indeterminate size="24" class="mb-2" />
        <p class="text-grey mt-2">加载中...</p>
      </v-card-text>
    </v-card>

    <!-- 新建书库对话框 -->
    <v-dialog v-model="showCreateDialog" max-width="420">
      <v-card>
        <v-card-title>新建书库</v-card-title>
        <v-card-text>
          <v-radio-group v-model="newLibMode" inline density="compact" hide-details class="mb-3">
            <v-radio label="复制导入" value="copy" />
            <v-radio label="选择文件夹" value="folder" />
          </v-radio-group>
          <v-text-field
            v-model="newLibName"
            label="书库名称"
            variant="outlined"
            density="compact"
            class="mb-2"
            hide-details
            autofocus
          />
          <v-btn
            v-if="newLibMode === 'folder'"
            variant="outlined"
            size="small"
            block
            @click="selectFolder"
            class="mt-2"
          >
            <v-icon size="16" class="mr-1">mdi-folder-open</v-icon> 选择文件夹
          </v-btn>
          <p v-if="selectedFolderPath" class="text-caption mt-1">{{ selectedFolderPath }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showCreateDialog = false">取消</v-btn>
          <v-btn color="primary" @click="createLibrary" :disabled="!newLibName.trim()">创建</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 删除确认对话框 -->
    <v-dialog v-model="showDeleteDialog" max-width="380">
      <v-card>
        <v-card-title>确认删除</v-card-title>
        <v-card-text>
          确定要删除书库 <strong>{{ deleteTarget?.name }}</strong> 吗？
          书库中的书籍将移至默认书库。
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showDeleteDialog = false">取消</v-btn>
          <v-btn color="error" @click="doDelete">删除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 隐私锁对话框 -->
    <v-dialog v-model="showPrivacyDialog" max-width="400">
      <v-card>
        <v-card-title>
          {{ privacyLocked ? '解锁书库' : '设置隐私锁' }}
        </v-card-title>
        <v-card-text>
          <p class="text-caption mb-2">
            <v-icon size="14" color="info">mdi-information</v-icon>
            隐私锁可以为该书库设置独立的访问密码，加密书库内所有书籍内容。
          </p>

          <template v-if="privacyLocked">
            <v-text-field
              v-model="privacyCurrentPassword"
              label="当前密码"
              type="password"
              variant="outlined"
              density="compact"
              class="mb-2"
              hide-details
              autofocus
            />
          </template>

          <v-text-field
            v-model="privacyNewPassword"
            label="新密码"
            type="password"
            variant="outlined"
            density="compact"
            class="mb-2"
            :hint="privacyLocked ? '留空表示不移除密码' : '8位以上，含大写+小写+数字'"
            persistent-hint
          />

          <v-text-field
            v-model="privacyConfirmPassword"
            label="确认密码"
            type="password"
            variant="outlined"
            density="compact"
            hide-details
          />

          <v-alert
            v-if="privacyError"
            type="error"
            density="compact"
            variant="tonal"
            class="mt-2"
          >{{ privacyError }}</v-alert>
          <v-alert
            v-if="privacySuccess"
            type="success"
            density="compact"
            variant="tonal"
            class="mt-2"
          >{{ privacySuccess }}</v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closePrivacyDialog">取消</v-btn>
          <v-btn
            v-if="privacyLocked"
            color="error"
            variant="text"
            @click="removePrivacy"
            :disabled="!privacyCurrentPassword"
          >移除锁定</v-btn>
          <v-btn
            color="primary"
            @click="setPrivacy"
            :disabled="!privacyNewPassword"
          >{{ privacyLocked ? '更改密码' : '设置锁定' }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 查看书库内容对话框 -->
    <v-dialog v-model="showViewDialog" max-width="500">
      <v-card>
        <v-card-title>{{ viewLibName }}</v-card-title>
        <v-card-text>
          <v-list density="compact">
            <v-list-item
              v-for="book in viewLibBooks"
              :key="book.id"
              :title="book.title"
              :subtitle="book.author"
              @click="openBook(book.id)"
            >
              <template #prepend>
                <v-avatar size="32" rounded>
                  <v-img v-if="book.cover" :src="book.cover" cover />
                  <v-icon v-else>mdi-book</v-icon>
                </v-avatar>
              </template>
            </v-list-item>
          </v-list>
          <p v-if="viewLibBooks.length === 0" class="text-grey text-center py-4">暂无书籍</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showViewDialog = false">关闭</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBookshelfStore } from '@/stores/bookshelf'
import { DEFAULT_LIBRARY_ID } from '@/constants'
import {
  isLibraryLocked,
  setLibraryLock,
  verifyLibraryLock,
  removeLibraryLock,
  validatePassword
} from '@/services/privacy-lock'
import type { Library } from '@/types'

const router = useRouter()
const bookshelf = useBookshelfStore()

const libraries = computed(() => bookshelf.libraries)
const editingId = ref('')
const editName = ref('')

// Create
const showCreateDialog = ref(false)
const newLibMode = ref<'copy' | 'folder'>('copy')
const newLibName = ref('')
const selectedFolderPath = ref('')

// Delete
const showDeleteDialog = ref(false)
const deleteTarget = ref<Library | null>(null)

// Privacy
const showPrivacyDialog = ref(false)
const privacyTargetId = ref('')
const privacyLocked = ref(false)
const privacyCurrentPassword = ref('')
const privacyNewPassword = ref('')
const privacyConfirmPassword = ref('')
const privacyError = ref('')
const privacySuccess = ref('')

// View
const showViewDialog = ref(false)
const viewLibId = ref('')
const viewLibName = ref('')
const viewLibBooks = computed(() =>
  bookshelf.books.filter(b => b.libraryId === viewLibId.value)
)

// Lock status cache
const lockedLibs = ref(new Set<string>())

async function refreshLockStatus() {
  const ids = libraries.value.map(l => l.id)
  const newSet = new Set<string>(lockedLibs.value)
  for (const id of ids) {
    const locked = await isLibraryLocked(id)
    if (locked) newSet.add(id)
    else newSet.delete(id)
  }
  lockedLibs.value = newSet // Re-assign to trigger Vue reactivity (ref<Set> doesn't track in-place mutations)
}

onMounted(async () => {
  await refreshLockStatus()
})

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Rename ──

function startRename(lib: Library) {
  editingId.value = lib.id
  editName.value = lib.name
}

function cancelEdit() {
  editingId.value = ''
  editName.value = ''
}

async function saveRename(id: string) {
  const name = editName.value.trim()
  if (!name) return
  await bookshelf.renameLibrary(id, name)
  editingId.value = ''
  editName.value = ''
}

// ── View ──

function viewLibrary(id: string) {
  const lib = libraries.value.find(l => l.id === id)
  if (!lib) return
  viewLibId.value = id
  viewLibName.value = lib.name
  showViewDialog.value = true
}

function openBook(bookId: string) {
  showViewDialog.value = false
  router.push(`/reader/${bookId}`)
}

// ── Delete ──

function confirmDelete(lib: Library) {
  deleteTarget.value = lib
  showDeleteDialog.value = true
}

async function doDelete() {
  if (!deleteTarget.value) return
  const targetId = deleteTarget.value.id
  await bookshelf.deleteLibrary(targetId)
  showDeleteDialog.value = false
  lockedLibs.value = new Set([...lockedLibs.value].filter(id => id !== targetId))
  deleteTarget.value = null
}

// ── Create ──

async function selectFolder() {
  if (window.electronAPI?.openFolder) {
    const result = await window.electronAPI.openFolder()
    if (!result.canceled && result.folderPath) {
      selectedFolderPath.value = result.folderPath
    }
  }
}

async function createLibrary() {
  const name = newLibName.value.trim()
  if (!name) return
  await bookshelf.createLibrary(name, newLibMode.value === 'folder' ? selectedFolderPath.value : '')
  showCreateDialog.value = false
  newLibName.value = ''
  selectedFolderPath.value = ''
}

// ── Privacy ──

async function openPrivacyDialog(libId: string) {
  privacyTargetId.value = libId
  privacyError.value = ''
  privacySuccess.value = ''
  privacyCurrentPassword.value = ''
  privacyNewPassword.value = ''
  privacyConfirmPassword.value = ''
  privacyLocked.value = await isLibraryLocked(libId)
  showPrivacyDialog.value = true
}

function closePrivacyDialog() {
  showPrivacyDialog.value = false
  privacyTargetId.value = ''
}

async function setPrivacy() {
  privacyError.value = ''
  privacySuccess.value = ''

  if (privacyNewPassword.value !== privacyConfirmPassword.value) {
    privacyError.value = '两次输入的密码不一致'
    return
  }

  const validation = validatePassword(privacyNewPassword.value)
  if (!validation.valid) {
    privacyError.value = validation.message
    return
  }

  try {
    if (privacyLocked.value) {
      // 更改密码：先验证旧密码
      const valid = await verifyLibraryLock(privacyTargetId.value, privacyCurrentPassword.value)
      if (!valid) {
        privacyError.value = '当前密码错误'
        return
      }
      await removeLibraryLock(privacyTargetId.value, privacyCurrentPassword.value)
    }

    await setLibraryLock(privacyTargetId.value, privacyNewPassword.value)
    lockedLibs.value = new Set([...lockedLibs.value, privacyTargetId.value])
    privacyLocked.value = true
    privacySuccess.value = '隐私锁设置成功'
    privacyCurrentPassword.value = ''
    privacyNewPassword.value = ''
    privacyConfirmPassword.value = ''
  } catch (e: any) {
    privacyError.value = e.message || '设置失败'
  }
}

async function removePrivacy() {
  privacyError.value = ''
  privacySuccess.value = ''

  try {
    await removeLibraryLock(privacyTargetId.value, privacyCurrentPassword.value)
    lockedLibs.value = new Set([...lockedLibs.value].filter(id => id !== privacyTargetId.value))
    privacyLocked.value = false
    privacySuccess.value = '隐私锁已移除'
    privacyCurrentPassword.value = ''
    privacyNewPassword.value = ''
    privacyConfirmPassword.value = ''
  } catch (e: any) {
    privacyError.value = e.message || '移除失败'
  }
}
</script>

<style scoped>
.library-view {
  padding: 24px;
  max-width: 960px;
  margin: 0 auto;
  height: 100%;
  overflow-y: auto;
}

.library-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.library-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}

.lib-row {
  min-height: 64px;
}

.lib-name {
  font-size: 15px;
  font-weight: 600;
}

.edit-name-field {
  max-width: 200px;
}

.gap-2 {
  gap: 8px;
}

.gap-1 {
  gap: 4px;
}
</style>
