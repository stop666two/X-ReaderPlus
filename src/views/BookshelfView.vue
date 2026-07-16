<template>
  <div class="bookshelf-view">
    <!-- ========== Library Header ========== -->
    <div class="library-header px-4 py-2 d-flex align-center border-b">
      <div class="d-flex align-center">
        <v-icon size="20" class="mr-1" color="medium-emphasis">mdi-bookshelf</v-icon>
        <span class="text-body-2 font-weight-medium">{{ store.activeLibrary?.name || '默认书库' }}</span>
        <v-icon size="14" class="mx-1" color="medium-emphasis">mdi-chevron-right</v-icon>
        <span class="text-caption text-medium-emphasis">{{ localFilteredBooks.length }} 本书</span>
      </div>
      <v-spacer />
      <!-- Library switcher -->
      <v-menu>
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            size="x-small"
            variant="text"
            icon="mdi-chevron-down"
            title="切换书库"
          />
        </template>
        <v-list density="compact" min-width="180">
          <v-list-item
            v-for="lib in store.libraries"
            :key="lib.id"
            :title="lib.name"
            :subtitle="lib.mode === 'folder' ? `文件夹 · ${lib.path}` : '默认书库'"
            :active="lib.id === store.activeLibraryId"
            @click="store.setActiveLibrary(lib.id)"
          >
            <template #prepend>
              <v-icon size="18" :color="lib.id === store.activeLibraryId ? 'primary' : ''">
                {{ lib.id === store.activeLibraryId ? 'mdi-folder-open' : 'mdi-folder' }}
              </v-icon>
            </template>
          </v-list-item>
          <v-divider />
          <v-list-item
            prepend-icon="mdi-plus"
            title="新建书库..."
            @click="showImportDialog = true"
          />
        </v-list>
      </v-menu>
    </div>

    <!-- ========== Toolbar ========== -->
    <div class="toolbar-custom border-b px-3 py-1">
      <div class="d-flex align-center flex-wrap gap-2">
        <v-text-field v-model="searchInput" prepend-inner-icon="mdi-magnify" placeholder="搜索书名或作者..." hide-details variant="outlined" density="compact" class="search-field" clearable />
        <v-select v-model="sortModel" :items="sortOptions" item-title="title" item-value="value" density="compact" variant="outlined" hide-details class="sort-select" />
        <v-tooltip :text="store.sortOrder === 'desc' ? '当前倒序 · 点击切换正序' : '当前正序 · 点击切换倒序'">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              size="x-small"
              :variant="store.sortOrder === 'desc' ? 'tonal' : 'text'"
              :color="store.sortOrder === 'desc' ? 'primary' : ''"
              icon="mdi-sort-reverse-variant"
              @click="toggleSortOrder"
            />
          </template>
        </v-tooltip>
        <v-select v-model="store.filterTag" :items="tagItems" item-title="title" item-value="value" density="compact" variant="outlined" hide-details clearable placeholder="标签" class="tag-select" />
        <v-spacer />
        <div class="d-flex align-center gap-2">
          <v-btn-toggle v-model="viewModeToggle" mandatory density="compact" variant="outlined" divided class="view-toggle-group">
            <v-btn size="small" prepend-icon="mdi-view-grid">网格</v-btn>
            <v-btn size="small" prepend-icon="mdi-view-list">列表</v-btn>
          </v-btn-toggle>
          <!-- Grid cover size slider (grid mode only) -->
          <v-btn-toggle
            v-if="store.viewMode === 'grid'"
            v-model="gridSizeToggle"
            mandatory
            density="compact"
            variant="outlined"
            divided
            class="grid-size-toggle-group"
          >
            <v-btn size="x-small" icon="mdi-image-size-select-small" title="小封面" />
            <v-btn size="x-small" icon="mdi-image-size-select-actual" title="中封面" />
            <v-btn size="x-small" icon="mdi-image-size-select-large" title="大封面" />
          </v-btn-toggle>
          <template v-if="crossPageSelectedIds.size > 0 || store.selectedIds.size > 0">
            <v-btn size="small" variant="tonal" prepend-icon="mdi-select-all" @click="selectAllCurrentPage()">全选</v-btn>
            <v-btn size="small" variant="tonal" prepend-icon="mdi-select-off" @click="clearSelectionCurrentPage()">取消选择</v-btn>
            <v-btn size="small" variant="tonal" prepend-icon="mdi-swap-horizontal" @click="invertSelectionCurrentPage()">反选</v-btn>
            <v-btn size="small" color="error" variant="tonal" prepend-icon="mdi-delete" @click="showConfirm = true">删除({{ crossPageSelectedIds.size }})</v-btn>
          </template>
          <v-btn color="primary" size="small" variant="tonal" prepend-icon="mdi-plus" @click="showImportDialog = true">导入</v-btn>
          <v-btn
            v-if="importHistory.length > 0"
            size="small"
            variant="text"
            :color="showImportHistory ? 'primary' : ''"
            prepend-icon="mdi-history"
            @click="showImportHistory = !showImportHistory"
          >
            导入记录
            <v-badge :content="importHistory.length" inline color="primary" class="ml-1" />
          </v-btn>
        </div>
      </div>
    </div>

    <!-- ========== Import Progress ========== -->
    <div v-if="store.isLoading && store.importProgress.total > 0" class="import-progress-bar">
      <v-progress-linear
        :model-value="(store.importProgress.current / store.importProgress.total) * 100"
        color="primary"
        height="4"
        :striped="true"
      />
      <div class="text-center pa-1 text-caption text-medium-emphasis">
        {{ store.importProgress.message }}
      </div>
    </div>
    <div v-else-if="store.isLoading" class="text-center pa-4">
      <v-progress-circular indeterminate size="24" class="mr-2" />
      <span class="text-caption text-medium-emphasis">正在加载...</span>
    </div>

    <!-- ========== Export Progress ========== -->
    <div v-if="exportingBook" class="export-progress-bar pa-2 border-b">
      <div class="d-flex align-center px-2">
        <v-progress-circular indeterminate size="16" class="mr-2" />
        <span class="text-caption">{{ exportLabel }}</span>
      </div>
    </div>

    <!-- ========== Import History Panel ========== -->
    <div v-if="showImportHistory && importHistory.length > 0" class="import-history-panel border-b">
      <div class="d-flex align-center px-3 py-1">
        <v-icon size="16" color="medium-emphasis" class="mr-1">mdi-history</v-icon>
        <span class="text-caption font-weight-medium">导入记录 ({{ importHistory.length }})</span>
        <v-spacer />
        <v-btn size="x-small" variant="text" icon="mdi-close" @click="showImportHistory = false" />
      </div>
      <v-list density="compact" max-height="160" class="py-0">
        <v-list-item
          v-for="entry in importHistory.slice().reverse()"
          :key="entry.id"
          density="compact"
          :title="entry.name"
          :subtitle="formatDate(entry.timestamp) + ' · ' + entry.statusText"
        >
          <template #prepend>
            <v-icon size="16" :color="entry.statusIconColor">
              {{ entry.statusIcon }}
            </v-icon>
          </template>
        </v-list-item>
      </v-list>
    </div>

    <!-- ========== Empty State / Drop Zone ========== -->
    <div
      v-if="store.filteredLibraryBooks.length === 0 && !store.isLoading"
      class="drop-zone-container"
      @drop.prevent="handleDrop"
      @dragover.prevent
    >
      <div
        class="drop-zone"
        :class="{ 'drop-zone-active': isDragOver }"
        @dragenter="isDragOver = true"
        @dragleave="isDragOver = false"
        @drop="isDragOver = false"
      >
        <div class="drop-zone-icon-wrap">
          <v-icon size="80" color="medium-emphasis">mdi-book-open-page-variant-outline</v-icon>
        </div>
        <p class="text-h6 mb-1 drop-zone-title">将电子书拖放到此处</p>
        <p class="text-body-2 text-medium-emphasis drop-zone-subtitle">
          支持 EPUB、TXT、Markdown、HTML、MOBI、AZW3、FB2、DJVU<br />
          DOCX、RTF、ODT、PDF、CBR、CBZ、CBT、CB7
        </p>
        <v-btn
          color="primary"
          size="large"
          class="mt-3"
          prepend-icon="mdi-plus"
          @click="showImportDialog = true"
        >
          选择文件导入
        </v-btn>
      </div>
    </div>

    <!-- ========== Grid View ========== -->
    <div
      v-if="store.viewMode === 'grid' && localFilteredBooks.length > 0"
      class="books-grid pa-4"
      :class="'grid-' + gridSize"
    >
      <div
        v-for="book in displayedBooks"
        :key="book.id"
        v-memo="[book.id, store.selectedIds.has(book.id), book.progress]"
        class="book-card"
        :class="{ 'book-card-selected': store.selectedIds.has(book.id) }"
        @click="openBook(book.id)"
        @contextmenu.prevent="openContextMenu($event, book)"
      >
        <!-- Cover -->
        <div class="cover-wrapper">
          <img
            v-if="book.cover && !failedCovers.has(book.id)"
            :src="book.cover"
            class="cover-img"
            :alt="book.title"
            draggable="false"
            loading="lazy"
            @error="onCoverError(book.id)"
          />
          <div
            v-else
            class="cover-img cover-placeholder"
            :style="{ backgroundColor: getCoverColor(book.title) }"
          >
            <v-icon size="32" color="white">mdi-book</v-icon>
          </div>

          <!-- Format badge (top-right) -->
          <span class="format-badge" :class="'fmt-' + book.format">
            {{ book.format.toUpperCase() }}
          </span>

          <!-- Selection checkbox -->
          <v-checkbox
            :model-value="store.selectedIds.has(book.id)"
            @click.stop="toggleSelectBook(book.id)"
            density="compact"
            hide-details
            class="select-check"
          />
        </div>

        <!-- Info -->
        <div class="book-info">
          <div class="book-title" :title="book.title">{{ book.title }}</div>
          <div class="book-author" :title="book.author">{{ book.author || '未知作者' }}</div>

          <div class="book-meta">
            <span class="text-caption">{{ formatDate(book.addedAt) }}</span>
            <span class="text-caption">·</span>
            <span class="text-caption">{{ formatWordCount(book.wordCount) }}</span>
          </div>

          <!-- Library name -->
          <div v-if="store.activeLibraryId === '__all__'" class="book-library">
            {{ getLibraryName(book.libraryId) }}
          </div>

          <!-- Progress bar -->
          <div class="progress-bar-wrap">
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: Math.round(book.progress * 100) + '%' }"
              />
            </div>
            <span class="text-caption progress-text">
              {{ Math.round(book.progress * 100) }}%
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== List View ========== -->
    <div
      v-else-if="store.viewMode === 'list' && localFilteredBooks.length > 0"
      class="books-list pa-2"
    >
      <v-list density="compact" lines="two">
        <v-list-item
          v-for="book in displayedBooks"
          :key="book.id"
          v-memo="[book.id, store.selectedIds.has(book.id), book.progress]"
          :class="{ 'list-item-selected': store.selectedIds.has(book.id) }"
          @click="openBook(book.id)"
          @contextmenu.prevent="openContextMenu($event, book)"
        >
          <!-- Cover prepend -->
          <template #prepend>
            <div class="list-cover-wrapper">
              <img
                v-if="book.cover && !failedCovers.has(book.id)"
                :src="book.cover"
                class="list-cover"
                draggable="false"
                loading="lazy"
                @error="onCoverError(book.id)"
              />
              <div
                v-else
                class="list-cover list-cover-ph"
                :style="{ backgroundColor: getCoverColor(book.title) }"
              >
                <v-icon size="22" color="white">mdi-book</v-icon>
              </div>
            </div>
          </template>

          <!-- Title -->
          <v-list-item-title class="text-body-2 font-weight-medium">
            {{ book.title }}
          </v-list-item-title>

          <!-- Subtitle -->
          <v-list-item-subtitle>
            <span>{{ book.author || '未知作者' }}</span>
            <span class="mx-1">·</span>
            <span>{{ formatDate(book.addedAt) }}</span>
            <span class="mx-1">·</span>
            <span>{{ formatWordCount(book.wordCount) }}</span>
          </v-list-item-subtitle>

          <!-- Append: format + rating + progress + checkbox -->
          <template #append>
            <div class="list-meta">
              <span class="format-badge format-badge-sm" :class="'fmt-' + book.format">
                {{ book.format.toUpperCase() }}
              </span>
              <div v-if="book.rating > 0" class="d-flex align-center ml-1">
                <v-icon
                  v-for="i in 5"
                  :key="i"
                  size="10"
                  :color="i <= book.rating ? 'warning' : ''"
                >
                  {{ i <= book.rating ? 'mdi-star' : 'mdi-star-outline' }}
                </v-icon>
              </div>
              <div class="progress-bar-wrap-small ml-2">
                <div class="progress-bar progress-bar-sm">
                  <div
                    class="progress-fill"
                    :style="{ width: Math.round(book.progress * 100) + '%' }"
                  />
                </div>
              </div>
              <v-checkbox
                :model-value="store.selectedIds.has(book.id)"
                @click.stop="toggleSelectBook(book.id)"
                density="compact"
                hide-details
                class="ml-1"
              />
            </div>
          </template>
        </v-list-item>
      </v-list>
    </div>

    <!-- ========== Pagination Nav ========== -->
    <div
      v-if="totalPages > 1 && localFilteredBooks.length > 0"
      class="pagination-bar"
    >
      <div class="d-flex align-center justify-center gap-2">
        <v-tooltip text="上一页">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              size="small"
              variant="text"
              icon="mdi-chevron-left"
              :disabled="!hasPrev"
              @click="prevPage()"
            />
          </template>
        </v-tooltip>
        <!-- Page number buttons -->
        <template v-for="p in totalPages" :key="p">
          <v-btn
            v-if="p <= 7 || p > totalPages - 2 || Math.abs(p - currentPage) <= 1"
            size="x-small"
            :variant="p === currentPage ? 'tonal' : 'text'"
            :color="p === currentPage ? 'primary' : ''"
            class="page-btn"
            @click="goToPage(p)"
          >
            {{ p }}
          </v-btn>
          <span
            v-else-if="p === (currentPage <= 5 ? totalPages - 2 : 3) || p === (currentPage >= totalPages - 4 ? 3 : totalPages - 2)"
            class="text-caption text-medium-emphasis px-1"
          >...</span>
        </template>
        <v-tooltip text="下一页">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              size="small"
              variant="text"
              icon="mdi-chevron-right"
              :disabled="!hasNext"
              @click="nextPage()"
            />
          </template>
        </v-tooltip>
        <span class="text-caption text-medium-emphasis ml-2">
          第 {{ currentPage }}/{{ totalPages }} 页
        </span>
      </div>
    </div>

    <!-- Empty search results -->
    <div
      v-else-if="localFilteredBooks.length === 0 && store.books.length > 0 && !store.isLoading"
      class="text-center py-8"
    >
      <v-icon size="48" color="medium-emphasis" class="mb-2">mdi-magnify</v-icon>
      <p class="text-medium-emphasis">没有找到匹配的书籍</p>
      <p class="text-caption text-medium-emphasis">尝试修改搜索条件或清除筛选</p>
    </div>

    <!-- ========== Bottom Info Bar ========== -->
    <div class="bottom-bar px-3 py-1 d-flex align-center">
      <span class="text-caption text-medium-emphasis">
        共 {{ store.filteredLibraryBooks.length }} 本书
        <template v-if="store.searchQuery || store.filterTag">
          · 筛选出 {{ localFilteredBooks.length }} 本
        </template>
      </span>
      <v-spacer />
      <span v-if="crossPageSelectedIds.size > 0" class="text-caption text-primary">
        已选 {{ crossPageSelectedIds.size }} 本
      </span>
    </div>

    <!-- ========== Floating Batch Action Bar ========== -->
    <div v-if="crossPageSelectedIds.size > 0" class="floating-batch-bar">
      <span class="text-body-2 font-weight-medium">已选 {{ crossPageSelectedIds.size }} 本</span>
      <v-spacer />
      <v-btn size="small" color="primary" variant="elevated" prepend-icon="mdi-swap-horizontal" @click="invertSelectionCurrentPage()">
        反选
      </v-btn>
      <v-btn size="small" color="primary" variant="elevated" prepend-icon="mdi-select-all" @click="selectAllCurrentPage()">
        全选
      </v-btn>
      <v-btn size="small" color="error" variant="elevated" prepend-icon="mdi-delete" @click="showConfirm = true">
        删除
      </v-btn>
    </div>

    <!-- ========== Right-Click Context Menu ========== -->
    <v-menu
      v-model="showContextMenu"
      :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
      absolute
      close-on-content-click
      max-width="180"
    >
      <v-list density="compact">
        <v-list-item
          prepend-icon="mdi-information-outline"
          title="详情"
          @click="openDetail(contextMenuBook?.id || '')"
        />
        <v-list-item
          :prepend-icon="contextMenuBook && crossPageSelectedIds.has(contextMenuBook.id) ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'"
          :title="contextMenuBook && crossPageSelectedIds.has(contextMenuBook.id) ? '取消选择' : '选择'"
          @click="contextMenuBook && toggleSelectBook(contextMenuBook.id)"
        />
        <v-divider />
        <v-list-item
          prepend-icon="mdi-export"
          title="导出此书"
          @click="contextMenuBook && exportSingleBook(contextMenuBook)"
        />
        <v-list-item
          prepend-icon="mdi-delete-outline"
          title="删除"
          color="error"
          @click="deleteContextBook"
        />
      </v-list>
    </v-menu>

    <!-- ========== Import Dialog ========== -->
    <v-dialog v-model="showImportDialog" max-width="520">
      <v-card>
        <v-toolbar color="surface" density="compact" class="border-b">
          <v-toolbar-title class="text-body-1">导入书籍</v-toolbar-title>
          <v-spacer />
          <v-btn icon="mdi-close" size="small" variant="text" @click="showImportDialog = false" />
        </v-toolbar>

        <v-card-text class="pt-4">
          <!-- Import mode selection -->
          <label class="text-caption font-weight-medium d-block mb-1">导入方式</label>
          <v-radio-group v-model="importMode" density="compact" hide-details class="mb-3" inline>
            <v-radio label="复制导入" value="copy" />
            <v-radio label="文件夹引用" value="folder" />
          </v-radio-group>

          <!-- Copy mode: drag zone + file picker -->
          <template v-if="importMode === 'copy'">
            <!-- Library selector -->
            <label class="text-caption font-weight-medium d-block mb-1">导入到书库</label>
            <v-select
              v-model="importTargetLibId"
              :items="importLibOptions"
              item-title="text"
              item-value="value"
              density="compact"
              variant="outlined"
              hide-details
              class="mb-3"
            />
            <div class="d-flex gap-1 mb-3" />

            <div
              class="import-drop-zone"
              :class="{ 'import-drop-zone-active': importDragOver }"
              @drop.prevent="handleImportDrop"
              @dragover.prevent
              @dragenter="importDragOver = true"
              @dragleave="importDragOver = false"
              @drop="importDragOver = false"
            >
              <v-icon size="40" color="medium-emphasis" class="mb-1">mdi-file-document-multiple-outline</v-icon>
              <p class="text-body-2 text-medium-emphasis mb-1">拖拽文件到此处</p>
              <p class="text-caption text-medium-emphasis">
                或点击下方按钮选择文件
              </p>
            </div>

            <div class="text-center mt-3">
              <v-btn
                variant="outlined"
                prepend-icon="mdi-file-plus"
                @click="pickFiles"
              >
                选择文件
              </v-btn>
            </div>

            <!-- Selected files list -->
            <div v-if="pendingFiles.length > 0" class="mt-3">
              <div class="text-caption font-weight-medium mb-1">
                待导入 {{ pendingFiles.length }} 个文件
              </div>
              <v-list density="compact" max-height="140" class="border rounded">
                <v-list-item
                  v-for="(f, i) in pendingFiles"
                  :key="i"
                  :title="f.name"
                  density="compact"
                >
                  <template #prepend>
                    <v-icon size="16" color="medium-emphasis">mdi-file-outline</v-icon>
                  </template>
                </v-list-item>
              </v-list>
            </div>
          </template>

          <!-- Folder mode: folder picker + library name -->
          <template v-else>
            <div class="mb-3">
              <label class="text-caption font-weight-medium d-block mb-1">书库名称</label>
              <v-text-field
                v-model="newLibraryName"
                placeholder="输入书库名称..."
                density="compact"
                variant="outlined"
                hide-details
              />
            </div>

            <v-btn
              variant="outlined"
              prepend-icon="mdi-folder-open"
              block
              @click="pickFolder"
            >
              {{ newLibraryPath ? '重新选择文件夹' : '选择文件夹' }}
            </v-btn>

            <div v-if="newLibraryPath" class="mt-2 pa-2 bg-surface-variant rounded text-caption">
              <v-icon size="14" color="medium-emphasis" class="mr-1">mdi-folder</v-icon>
              {{ newLibraryPath }}
            </div>
          </template>

          <!-- Dialog progress -->
          <div v-if="dialogImporting" class="mt-4">
            <v-progress-linear
              v-if="store.importProgress.total > 0"
              :model-value="(store.importProgress.current / store.importProgress.total) * 100"
              color="primary"
              height="4"
              :striped="true"
            />
            <div class="text-center pa-2 text-caption">
              {{ store.importProgress.message }}
            </div>
          </div>
        </v-card-text>

        <v-card-actions class="border-t">
          <v-spacer />
          <v-btn variant="text" @click="showImportDialog = false">取消</v-btn>
          <v-btn
            color="primary"
            :loading="dialogImporting"
            :disabled="!canStartImport"
            @click="startImport"
          >
            开始导入
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ========== Book Detail Dialog ========== -->
    <v-dialog v-model="showDetailDialog" max-width="520">
      <v-card v-if="detailBook">
        <v-toolbar color="surface" density="compact" class="border-b">
          <v-toolbar-title class="text-body-1">书籍详情</v-toolbar-title>
          <v-spacer />
          <v-btn icon="mdi-close" size="small" variant="text" @click="showDetailDialog = false" />
        </v-toolbar>
        <v-card-text class="pt-4">
          <div class="d-flex gap-4">
            <!-- Cover -->
            <div class="detail-cover">
              <img
                v-if="detailBook.cover && !failedCovers.has(detailBook.id)"
                :src="detailBook.cover"
                class="detail-cover-img"
                loading="lazy"
                @error="onCoverError(detailBook.id)"
              />
              <div
                v-else
                class="detail-cover-img detail-cover-ph"
                :style="{ backgroundColor: getCoverColor(detailBook.title) }"
              >
                <v-icon size="56" color="white">mdi-book</v-icon>
              </div>
            </div>

            <!-- Details -->
            <div class="flex-1">
              <div class="text-body-1 font-weight-medium mb-1">{{ detailBook.title }}</div>
              <div class="text-body-2 text-medium-emphasis mb-2">
                {{ detailBook.author || '未知作者' }}
              </div>

              <div class="text-caption text-medium-emphasis mb-2">
                <div>格式: {{ detailBook.format.toUpperCase() }}</div>
                <div>大小: {{ formatSize(detailBook.size) }}</div>
                <div>字数: {{ detailBook.wordCount.toLocaleString() }} 字</div>
                <div>添加于: {{ formatDate(detailBook.addedAt) }}</div>
                <div v-if="detailBook.lastReadAt">
                  最近阅读: {{ formatDate(detailBook.lastReadAt) }}
                </div>
              </div>

              <div class="mt-2">
                <label class="text-caption font-weight-medium d-block mb-1">评分</label>
                <v-btn
                  v-for="i in 5"
                  :key="i"
                  :icon="i <= detailBook.rating ? 'mdi-star' : 'mdi-star-outline'"
                  size="x-small"
                  variant="text"
                  :color="i <= detailBook.rating ? 'warning' : ''"
                  @click="detailBook.rating = i"
                />
              </div>

              <div class="mt-2">
                <label class="text-caption font-weight-medium d-block mb-1">标签</label>
                <v-combobox
                  v-model="detailBook.tags"
                  :items="store.allTags"
                  chips
                  closable-chips
                  multiple
                  hide-details
                  density="compact"
                  variant="outlined"
                />
              </div>

              <div class="mt-2">
                <label class="text-caption font-weight-medium d-block mb-1">短评</label>
                <v-textarea
                  v-model="detailBook.review"
                  rows="2"
                  hide-details
                  density="compact"
                  variant="outlined"
                  placeholder="写点什么..."
                />
              </div>

              <!-- Progress -->
              <div class="mt-2">
                <label class="text-caption font-weight-medium d-block mb-1">阅读进度</label>
                <div class="d-flex align-center gap-2">
                  <div class="progress-bar flex-1">
                    <div
                      class="progress-fill"
                      :style="{ width: Math.round(detailBook.progress * 100) + '%' }"
                    />
                  </div>
                  <span class="text-caption">{{ Math.round(detailBook.progress * 100) }}%</span>
                </div>
              </div>
            </div>
          </div>
        </v-card-text>
        <v-card-actions class="border-t">
          <v-btn variant="text" prepend-icon="mdi-export" @click="exportSingleBook(detailBook!)">导出此书</v-btn>
          <v-spacer />
          <v-btn variant="text" @click="showDetailDialog = false">取消</v-btn>
          <v-btn color="primary" @click="saveDetail">保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ========== Confirm Delete Dialog ========== -->
    <v-dialog v-model="showConfirm" max-width="400" persistent>
      <v-card>
        <v-card-title class="text-body-1">确认删除</v-card-title>
        <v-card-text>
          <p class="mb-1">确定要删除选中的 {{ crossPageSelectedIds.size }} 本书吗？</p>
          <p class="text-caption text-medium-emphasis">删除的书籍将移入回收站，可以恢复。</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showConfirm = false">取消</v-btn>
          <v-btn color="error" variant="tonal" @click="confirmDelete">删除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ========== Import Result Dialog ========== -->
    <v-dialog v-model="showImportResult" max-width="640">
      <v-card>
        <v-toolbar density="compact" color="surface">
          <v-toolbar-title>
            <v-icon class="mr-2" :color="importResultData.failed > 0 ? 'warning' : 'success'">
              {{ importResultData.failed > 0 ? 'mdi-alert-circle' : 'mdi-check-circle' }}
            </v-icon>
            导入完成
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon="mdi-close" size="small" variant="text" @click="showImportResult = false; store.clearImportResult()" />
        </v-toolbar>
        <div class="pa-4">
          <div class="text-body-2 mb-3">
            共 <strong>{{ importResultData.imported + importResultData.failed + (importResultData.skipped || 0) }}</strong> 个文件
            <br>
            ✓ 成功 <strong>{{ importResultData.imported }}</strong> 本
            <template v-if="importResultData.skipped > 0"> | ⏭ 跳过 <strong>{{ importResultData.skipped }}</strong> 本（重复）</template>
            <template v-if="importResultData.failed > 0"> | ✗ 失败 <strong class="text-error">{{ importResultData.failed }}</strong> 本</template>
          </div>
          <v-textarea
            v-if="importResultData.errors.length > 0"
            :model-value="importResultData.errors.map(e => `[${e.type}] ${e.file}\n  ${e.detail}`).join('\n\n')"
            readonly
            variant="outlined"
            density="compact"
            hide-details
            rows="10"
            class="import-error-log"
            style="font-family: monospace; font-size: 12px;"
          />
        </div>
        <v-card-actions>
          <v-spacer />
          <v-btn
            v-if="importResultData.errors.length > 0"
            variant="text"
            prepend-icon="mdi-content-copy"
            @click="copyImportErrors"
          >
            复制
          </v-btn>
          <v-btn color="primary" @click="showImportResult = false; store.clearImportResult()">
            确定
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ========== Snackbar ========== -->
    <v-snackbar v-model="showSnackbar" :color="snackbarColor" location="bottom" timeout="3000">
      {{ snackbarText }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useBookshelfStore } from '@/stores/bookshelf'
import { usePagination, getPageSize } from '@/composables/usePagination'
import dayjs from 'dayjs'
import { logger } from '@/services/log'
import { DEFAULT_LIBRARY_ID } from '@/constants'
import { sha256, blobToArrayBuffer } from '@/services/integrity'
import type { Book, ImportMode, SortField, SortOrder } from '@/types'

// ========== Stores & Router ==========
const store = useBookshelfStore()
const router = useRouter()

// ========== Import History Entry ==========
interface ImportHistoryEntry {
  id: string
  name: string
  status: 'success' | 'failed' | 'duplicate'
  timestamp: number
  statusText: string
  statusIcon: string
  statusIconColor: string
}

// ========== Local State ==========
const isDragOver = ref(false)

// Export progress
const exportingBook = ref(false)
const exportLabel = ref('')

// Snackbar
const showSnackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

function snack(msg: string, color: string = 'success') {
  snackbarText.value = msg
  snackbarColor.value = color
  showSnackbar.value = true
}

// Track cover images that failed to load so we show fallback instead of broken image
const failedCovers = ref(new Set<string>())
function onCoverError(bookId: string) {
  failedCovers.value = new Set([...failedCovers.value, bookId])
}

// Grid size: 0=small, 1=medium(default), 2=large
const gridSizeToggle = ref(1)
const gridSize = ref<'small' | 'medium' | 'large'>('medium')
watch(gridSizeToggle, (v) => {
  gridSize.value = (['small', 'medium', 'large'] as const)[v]
})

// Import history
const importHistory = ref<ImportHistoryEntry[]>([])
const showImportHistory = ref(false)

// View toggle
const viewModeToggle = ref(store.viewMode === 'grid' ? 0 : 1)
watch(viewModeToggle, (v) => {
  store.viewMode = v === 0 ? 'grid' : 'list'
})
// Sync from store
watch(() => store.viewMode, (v) => {
  viewModeToggle.value = v === 'grid' ? 0 : 1
})

// Context menu
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuBook = ref<Book | null>(null)

// Detail dialog
const showDetailDialog = ref(false)
const detailBook = ref<Book | null>(null)

// Confirm dialog
const showConfirm = ref(false)

// Import dialog
const showImportDialog = ref(false)
const showNewLibDialog = ref(false)
const importMode = ref<ImportMode>('copy')
const importDragOver = ref(false)
const pendingFiles = ref<{ name: string; path: string }[]>([])
const newLibraryName = ref('')
const newLibraryPath = ref('')
const dialogImporting = ref(false)
const importTargetLibId = ref(DEFAULT_LIBRARY_ID)

const importLibOptions = computed(() => [
  ...store.libraries.map(l => ({ text: l.name + (l.id === DEFAULT_LIBRARY_ID ? '（默认）' : ''), value: l.id }))
])

// ========== Import Result ==========
const showImportResult = ref(false)
const importResultData = ref<{ imported: number; failed: number; skipped: number; errors: Array<{ file: string; type: string; detail: string }> }>({ imported: 0, failed: 0, skipped: 0, errors: [] })

watch(() => store.importResult, (val) => {
  if (val && val.timestamp > 0) {
    importResultData.value = val
    showImportResult.value = true
  }
})

function copyImportErrors() {
  const text = importResultData.value.errors.map(e => `[${e.type}] ${e.file}\n  ${e.detail}`).join('\n\n')
  navigator.clipboard?.writeText(text).catch(() => {})
}

// ========== Debounced Search ==========
let debounceTimer: ReturnType<typeof setTimeout> | null = null
const searchInput = ref(store.searchQuery)

watch(searchInput, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    store.searchQuery = val
  }, 300)
})

// Sync external changes back (e.g. if store.searchQuery is cleared elsewhere)
watch(() => store.searchQuery, (val) => {
  if (val !== searchInput.value) {
    searchInput.value = val
  }
})

// ========== Local filtered books — use the store's pre-computed filteredBooks ==========
const localFilteredBooks = computed(() => store.filteredBooks)

// ========== Pagination ==========
const bookshelfPageSize = ref(30)
function scrollToTop() {
  nextTick(() => {
    const grid = document.querySelector('.books-grid') || document.querySelector('.books-list')
    if (grid) grid.scrollTop = 0
  })
}

const {
  currentPage, totalPages, pagedItems,
  hasNext, hasPrev, nextPage, prevPage, goToPage, reset: resetPagination
} = usePagination(localFilteredBooks, bookshelfPageSize, { onPageChange: scrollToTop })

// Direct alias — pagedItems is already a computed
const displayedBooks = pagedItems

// Reset pagination when sort/search/tag/library changes
watch(
  [() => store.searchQuery, () => store.filterTag, () => store.sortField, () => store.sortOrder, () => store.activeLibraryId],
  () => { resetPagination() }
)

// ========== Cross-Page Batch Selection ==========
const crossPageSelectedIds = ref<Set<string>>(new Set())

/** Sync a single book toggle to cross-page set */
function toggleSelectBook(id: string) {
  store.toggleSelect(id)
  const cross = new Set(crossPageSelectedIds.value)
  if (store.selectedIds.has(id)) {
    cross.add(id)
  } else {
    cross.delete(id)
  }
  crossPageSelectedIds.value = cross
}

/** Select all books on the current page — adds to cross-page set */
function selectAllCurrentPage() {
  const cross = new Set(crossPageSelectedIds.value)
  const currentIds = pagedItems.value.map(b => b.id)
  for (const id of currentIds) cross.add(id)
  crossPageSelectedIds.value = cross
  store.selectedIds = new Set(cross) // Show all selected items across pages
}

/** Clear current-page books from both store.selectedIds and cross-page set */
function clearSelectionCurrentPage() {
  const currentIds = new Set(pagedItems.value.map(b => b.id))
  const cross = new Set(crossPageSelectedIds.value)
  for (const id of currentIds) cross.delete(id)
  crossPageSelectedIds.value = cross
  store.clearSelection()
}

/** Invert selection on current page only — syncs to cross-page set */
function invertSelectionCurrentPage() {
  const currentIds = pagedItems.value.map(b => b.id)
  const cross = new Set(crossPageSelectedIds.value)
  const newStore = new Set<string>()
  for (const id of currentIds) {
    if (cross.has(id)) {
      cross.delete(id)
    } else {
      cross.add(id)
      newStore.add(id)
    }
  }
  crossPageSelectedIds.value = cross
  store.selectedIds = newStore
}

// When page changes, restore store.selectedIds from crossPageSelectedIds for the new page
watch(currentPage, () => {
  nextTick(() => {
    const currentIds = new Set(pagedItems.value.map(b => b.id))
    const restored = new Set<string>()
    currentIds.forEach(id => {
      if (crossPageSelectedIds.value.has(id)) restored.add(id)
    })
    store.selectedIds = restored
  })
})

// ========== Sort ==========
const sortOptions: Array<{ title: string; value: string }> = [
  { title: '最近添加 (新→旧)', value: 'addedAt:desc' },
  { title: '最早添加 (旧→新)', value: 'addedAt:asc' },
  { title: '书名 A→Z', value: 'title:asc' },
  { title: '书名 Z→A', value: 'title:desc' },
  { title: '作者 A→Z', value: 'author:asc' },
  { title: '作者 Z→A', value: 'author:desc' },
  { title: '章节数 多→少', value: 'chapterCount:desc' },
  { title: '章节数 少→多', value: 'chapterCount:asc' },
  { title: '书库名称', value: 'libraryName:asc' },
]

const sortModel = computed({
  get: () => `${store.sortField}:${store.sortOrder}`,
  set: (val: string) => {
    const [field, order] = val.split(':') as [SortField, SortOrder]
    if (field) store.sortField = field
    if (order) store.sortOrder = order
  },
})

function toggleSortOrder() {
  store.sortOrder = store.sortOrder === 'desc' ? 'asc' : 'desc'
}

const tagItems = computed(() =>
  store.allTags.map(t => ({ title: t, value: t }))
)

const canStartImport = computed(() => {
  if (importMode.value === 'copy') {
    return pendingFiles.value.length > 0
  }
  return newLibraryPath.value.length > 0 && newLibraryName.value.trim().length > 0
})

// ========== Navigation ==========
function openBook(id: string) {
  router.push({ name: 'reader', params: { id } })
}

// ========== Detail Dialog ==========
function openDetail(id: string) {
  const book = store.books.find(b => b.id === id)
  if (book) {
    detailBook.value = { ...book }
    showDetailDialog.value = true
  }
}

async function saveDetail() {
  if (detailBook.value) {
    await store.updateBook(detailBook.value.id, detailBook.value)
    showDetailDialog.value = false
  }
}

// ========== Context Menu ==========
function openContextMenu(event: MouseEvent, book: Book) {
  contextMenuBook.value = book
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  showContextMenu.value = false
  nextTick(() => {
    showContextMenu.value = true
  })
}

async function deleteContextBook() {
  if (contextMenuBook.value) {
    await store.deleteBooks([contextMenuBook.value.id])
  }
}

async function exportSingleBook(book: Book) {
  exportingBook.value = true
  exportLabel.value = `正在导出《${book.title}》...`
  try {
    exportLabel.value = '正在下载文件...'
    const rawUrl = `http://127.0.0.1:34123/api/raw/${book.id}`
    const res = await fetch(rawUrl)
    if (res.ok) {
      const contentLength = res.headers.get('Content-Length')
      const total = contentLength ? parseInt(contentLength, 10) : 0

      exportLabel.value = total ? `正在读取 (${(total / 1024 / 1024).toFixed(1)}MB)...` : '正在读取...'
      const blob = await res.blob()
      exportLabel.value = '正在校验完整性...'
      const data = await blobToArrayBuffer(blob)
      const hash = await sha256(data)

      const ext = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1]
      const fileName = ext || `${book.title.replace(/[\\/:*?"<>|]/g, '_')}.${book.format}`

      if (book.contentHash && hash !== book.contentHash) {
        const msg = `文件完整性校验失败！\n\n预期 SHA-256: ${book.contentHash}\n实际 SHA-256: ${hash}\n\n文件可能已被篡改，是否仍要导出？`
        if (window.electronAPI?.showMessageBox) {
          const { response } = await window.electronAPI.showMessageBox({ type: 'warning', title: '完整性校验失败', message: msg, buttons: ['取消导出', '仍要导出'], defaultId: 0, cancelId: 0 })
          if (response !== 1) { exportingBook.value = false; return }
        } else if (!confirm(msg)) { exportingBook.value = false; return }
      }

      exportLabel.value = '正在保存文件...'
      if (window.electronAPI?.saveFile) {
        await window.electronAPI.saveFile({ defaultPath: fileName, data, type: 'application/octet-stream' })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = fileName; a.click(); URL.revokeObjectURL(url)
      }
      snack(`《${book.title}》导出成功`)
      exportingBook.value = false
      return
    }
  } catch (e: any) {
    exportLabel.value = '原始文件不可用，尝试重建...'
  }
  // Fallback: try to reconstruct from chapters
  try {
    exportLabel.value = '正在重建章节内容...'
    const chapters = book.chapterCount > 0 ? await window.electronAPI?.chapters.get(book.id) : null
    const parsed = chapters ? JSON.parse(chapters) : []
    const chs = Array.isArray(parsed) ? parsed : parsed.chapters || []

    let ext: string = book.format || 'txt'
    let content: string
    let mime = 'text/plain'

    if (['txt', 'md', 'markdown', 'html', 'xml'].includes(book.format)) {
      content = chs.map((c: any) => c.content).join('\n\n')
    } else {
      content = JSON.stringify({ book, chapters: chs }, null, 2)
      ext = 'json'
      mime = 'application/json'
    }

    const fileName = `${book.title.replace(/[\\/:*?"<>|]/g, '_')}.${ext}`

    exportLabel.value = '正在保存...'
    if (window.electronAPI?.saveFile) {
      const encoder = new TextEncoder()
      const bytes = encoder.encode(content)
      let bin = ''
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
      await window.electronAPI.saveFile({ defaultPath: fileName, data: bin, type: mime })
    } else {
      const blob2 = new Blob([content], { type: mime })
      const url2 = URL.createObjectURL(blob2)
      const a2 = document.createElement('a')
      a2.href = url2; a2.download = fileName; a2.click(); URL.revokeObjectURL(url2)
    }
    snack(`《${book.title}》导出成功`)
  } catch (e: any) {
    snack(`导出失败: ${e.message || '未知错误'}`, 'error')
  } finally {
    exportingBook.value = false
  }
}

// ========== Import ==========
async function pickFiles() {
  if (window.electronAPI) {
    const result = await window.electronAPI.openFiles()
    if (!result.canceled && result.filePaths.length > 0) {
      pendingFiles.value = result.filePaths.map((p: string) => ({
        name: p.split(/[\\/]/).pop() || p,
        path: p,
      }))
    }
  } else {
    // Browser fallback — wrap in a Promise so the caller can await
    await new Promise<void>((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = true
      input.accept = '.epub,.txt,.md,.markdown,.html,.htm,.fb2,.djvu,.docx,.rtf,.odt,.pdf,.cbr,.cbz,.cbt,.cb7,.chm,.lit,.lrf'
      input.onchange = () => {
        if (input.files) {
          pendingFiles.value = Array.from(input.files).map(f => ({
            name: f.name,
            path: (f as any).path || f.name,
          }))
        }
        resolve()
      }
      input.click()
    })
  }
}

async function pickFolder() {
  if (window.electronAPI) {
    // Try dedicated openFolder if available
    if (window.electronAPI.openFolder) {
      const result = await window.electronAPI.openFolder()
      if (!result.canceled && result.folderPath) {
        newLibraryPath.value = result.folderPath
        if (!newLibraryName.value) {
          newLibraryName.value = result.folderPath.split(/[\\/]/).pop() || '新书库'
        }
        return
      }
    }
    // Fallback: pick any file and derive folder path
    const result = await window.electronAPI.openFile({
      properties: ['openFile'],
      title: '选择目标文件夹内的任意文件（将使用其所在文件夹作为书库路径）',
    })
    if (!result.canceled && result.filePaths.length > 0) {
      const p = result.filePaths[0].replace(/\\/g, '/')
      const parts = p.split('/')
      parts.pop()
      newLibraryPath.value = parts.join('/')
      if (!newLibraryName.value) {
        newLibraryName.value = parts[parts.length - 1] || '新书库'
      }
    }
  }
}

async function startImport() {
  dialogImporting.value = true
  const beforeBookIds = new Set(store.books.map(b => b.id))
  const importedFiles: { name: string; path: string }[] = []

  try {
    if (importMode.value === 'copy') {
      const paths = pendingFiles.value.map(f => f.path)
      importedFiles.push(...pendingFiles.value.map(f => ({ name: f.name, path: f.path })))
      await store.importFiles(paths, importTargetLibId.value)
    } else {
      // Folder mode: create library then import files into it
      const lib = await store.createLibrary(newLibraryName.value.trim(), newLibraryPath.value)
      store.setActiveLibrary(lib.id)
      // Open file picker so user can import batch files into this new folder library
      if (window.electronAPI) {
        const result = await window.electronAPI.openFiles()
        if (!result.canceled && result.filePaths.length > 0) {
          importedFiles.push(...result.filePaths.map((p: string) => ({
            name: p.split(/[\\/]/).pop() || p,
            path: p,
          })))
          await store.importFiles(result.filePaths, lib.id, 'folder')
        }
      }
    }

    // Build import history from results
    const newBookIds = new Set(store.books.map(b => b.id))
    const newIds = [...newBookIds].filter(id => !beforeBookIds.has(id))
    const newBooks = store.books.filter(b => newIds.includes(b.id))

    for (const file of importedFiles) {
      const matched = newBooks.find(b => {
        const bn = b.path.split(/[\\/]/).pop() || ''
        return bn === file.name || file.name === (b.path.split(/[\\/]/).pop() || '')
      })
      let status: ImportHistoryEntry['status']
      if (matched) {
        status = 'success'
      } else {
        // Check if it was a duplicate
        status = store.importProgress.skippedDuplicates > 0 ? 'duplicate' : 'failed'
      }
      const entry = createHistoryEntry(file.name, status)
      importHistory.value.push(entry)
    }

    // If no per-file info available, check skippedDuplicates count
    if (store.importProgress.skippedDuplicates > 0 && importedFiles.length === 0) {
      // Folder mode without file picker; skip history tracking
    }

    // Show the history panel if any entries
    if (importHistory.value.length > 0) {
      showImportHistory.value = true
    }

    // Reset
    pendingFiles.value = []
    newLibraryName.value = ''
    newLibraryPath.value = ''
    showImportDialog.value = false
  } catch (e) {
    logger.error('Import failed:', e)
    // Record failures for pending files
    for (const file of importedFiles.length > 0 ? importedFiles : pendingFiles.value.map(f => ({ name: f.name, path: f.path }))) {
      importHistory.value.push(createHistoryEntry(file.name, 'failed'))
    }
    if (importHistory.value.length > 0) showImportHistory.value = true
  } finally {
    dialogImporting.value = false
  }
}

function handleImportDrop(e: DragEvent) {
  importDragOver.value = false
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  pendingFiles.value = Array.from(files).map(f => ({
    name: f.name,
    path: (f as any).path || f.name,
  }))
}

// ========== Drag & Drop (Main Area) ==========
async function handleDrop(e: DragEvent) {
  isDragOver.value = false
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  const filePaths: string[] = []
  const fileNames: string[] = []
  for (const file of files) {
    if ((file as any).path) {
      filePaths.push((file as any).path)
      fileNames.push(file.name)
    }
  }

  if (filePaths.length > 0) {
    const beforeBookIds = new Set(store.books.map(b => b.id))
    await store.importFiles(filePaths)

    // Track import history
    const newBookIds = new Set(store.books.map(b => b.id))
    const newIds = [...newBookIds].filter(id => !beforeBookIds.has(id))
    const newBooks = store.books.filter(b => newIds.includes(b.id))

    for (const name of fileNames) {
      const matched = newBooks.find(b => {
        const bn = b.path.split(/[\\/]/).pop() || ''
        return bn === name || name === (b.path.split(/[\\/]/).pop() || '')
      })
      const status: ImportHistoryEntry['status'] = matched ? 'success' : 'duplicate'
      importHistory.value.push(createHistoryEntry(name, status))
    }
    if (importHistory.value.length > 0) showImportHistory.value = true
  }
}

// ========== Batch Delete ==========
async function confirmDelete() {
  await store.deleteBooks(Array.from(crossPageSelectedIds.value))
  crossPageSelectedIds.value = new Set()
  store.clearSelection()
  showConfirm.value = false
}

// ========== Formatters ==========
function formatDate(ts: number): string {
  if (!ts) return '-'
  return dayjs(ts).format('YYYY-MM-DD')
}

function formatWordCount(count: number): string {
  if (!count) return '-'
  if (count >= 10000) {
    return (count / 10000).toFixed(1) + '万字'
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + '千字'
  }
  return count.toLocaleString() + '字'
}

function getLibraryName(libraryId: string): string {
  if (!libraryId || libraryId === 'default') return ''
  const lib = store.libraries.find(l => l.id === libraryId)
  return lib ? lib.name : ''
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

function createHistoryEntry(name: string, status: ImportHistoryEntry['status']): ImportHistoryEntry {
  const statusMap = {
    success:   { text: '导入成功', icon: 'mdi-check-circle', color: 'success' },
    failed:    { text: '导入失败', icon: 'mdi-alert-circle', color: 'error' },
    duplicate: { text: '已存在（重复）', icon: 'mdi-content-duplicate', color: 'warning' },
  }
  const s = statusMap[status]
  return {
    id: `${Date.now()}-${crypto.randomUUID?.()?.slice(0,8) || Math.random().toString(36).slice(2, 10)}`,
    name,
    status,
    timestamp: Date.now(),
    statusText: s.text,
    statusIcon: s.icon,
    statusIconColor: s.color,
  }
}

// ========== Cover Color ==========
const coverColors = [
  '#E53935', '#D81B60', '#8E24AA', '#5E35B1', '#3949AB',
  '#1E88E5', '#039BE5', '#00897B', '#43A047', '#689F38',
  '#F9A825', '#FF8F00', '#F4511E', '#6D4C41', '#546E7A', '#455A64',
]

function getCoverColor(title: string): string {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash)
  }
  return coverColors[Math.abs(hash) % coverColors.length]
}

// ========== Lifecycle ==========
onMounted(async () => {
  bookshelfPageSize.value = await getPageSize('bookshelf')
  if (store.books.length > 0) return
  if (store.libraries.length === 0) await store.loadLibraries()
  await store.loadBooks()
})

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<style scoped>
.bookshelf-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* ========== Library Header ========== */
.library-header {
  flex-shrink: 0;
  background: rgb(var(--v-theme-surface));
  min-height: 36px;
}

/* ========== Toolbar ========== */
.toolbar-custom {
  background: rgb(var(--v-theme-surface));
  flex-shrink: 0;
  min-height: 40px !important;
  padding: 0 8px;
}
.search-field { max-width: 220px; min-width: 140px; }
.sort-select { max-width: 170px; min-width: 130px; }
.tag-select { max-width: 130px; min-width: 90px; }
.gap-2 { gap: 8px; }

/* ========== Toggle Groups ========== */
.view-toggle-group,
.grid-size-toggle-group {
  flex-shrink: 0;
}
.view-toggle-group :deep(.v-btn) {
  min-width: 56px;
}
.grid-size-toggle-group :deep(.v-btn) {
  min-width: 28px;
  padding: 0 4px;
}

/* ========== Import Progress ========== */
.import-progress-bar {
  flex-shrink: 0;
}

/* ========== Empty / Drop Zone ========== */
.drop-zone-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.drop-zone {
  text-align: center;
  padding: 48px 32px;
  border: 2px dashed rgb(var(--v-theme-border));
  border-radius: 16px;
  transition: border-color 0.2s, background 0.2s;
  max-width: 520px;
  width: 100%;
}
.drop-zone-active {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.04);
}
.drop-zone-icon-wrap {
  margin-bottom: 8px;
}
.drop-zone-title {
  color: rgb(var(--v-theme-on-surface));
}
.drop-zone-subtitle {
  line-height: 1.6;
}

/* ========== Books Grid ========== */
.books-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 16px;
  align-content: start;
}

/* Grid size variants */
.books-grid.grid-small {
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 10px;
}
.books-grid.grid-medium {
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 16px;
}
.books-grid.grid-large {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
}

/* Scale down book-info text for small grid */
.books-grid.grid-small .book-title { font-size: 11px; }
.books-grid.grid-small .book-author { font-size: 10px; }
.books-grid.grid-small .book-meta { font-size: 9px; }
.books-grid.grid-small .format-badge { font-size: 7px; padding: 1px 4px; }

/* Scale up book-info text for large grid */
.books-grid.grid-large .book-title { font-size: 15px; }
.books-grid.grid-large .book-author { font-size: 13px; }
.books-grid.grid-large .book-meta { font-size: 12px; }

/* ========== Book Card ========== */
.book-card {
  content-visibility: auto;
  contain-intrinsic-size: auto 280px;
  contain: layout style paint;
  cursor: pointer;
  border-radius: 10px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  padding: 4px;
  will-change: transform;
}
.book-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
.book-card-selected .cover-wrapper {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 1px;
  border-radius: 6px;
}

/* ========== Cover ========== */
.cover-wrapper {
  position: relative;
  aspect-ratio: 3/4;
  border-radius: 6px;
  overflow: hidden;
  background: rgb(var(--v-theme-surface-variant));
}
.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Selection checkbox on cover */
.select-check {
  position: absolute;
  top: 2px;
  left: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
  transform: scale(0.7);
  pointer-events: auto;
}
.book-card:hover .select-check,
.book-card-selected .select-check {
  opacity: 1;
}

/* Format badge */
.format-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  line-height: 1.3;
}
.format-badge-sm {
  position: static;
  display: inline-block;
  font-size: 8px;
  padding: 1px 4px;
  border-radius: 3px;
}

/* Format-specific colors */
.fmt-epub { background: #1565C0; }
.fmt-pdf { background: #C62828; }
.fmt-txt { background: #546E7A; }
.fmt-markdown,
.fmt-html { background: #00897B; }
.fmt-fb2 { background: #6A1B9A; }
.fmt-djvu { background: #4E342E; }
.fmt-docx { background: #2E7D32; }
.fmt-rtf { background: #37474F; }
.fmt-odt { background: #0277BD; }
.fmt-chm { background: #283593; }
.fmt-lit { background: #5D4037; }
.fmt-lrf { background: #1B5E20; }
.fmt-cbr,
.fmt-cbz,
.fmt-cbt,
.fmt-cb7 { background: #AD1457; }

/* ========== Book Info ========== */
.book-info {
  padding: 6px 2px 2px;
}
.book-title {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgb(var(--v-theme-on-surface));
}
.book-author {
  font-size: 12px;
  color: #555;
  opacity: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 1px;
}
.book-meta {
  display: flex;
  gap: 4px;
  margin-top: 3px;
  font-size: 11px;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.6;
}
.book-rating {
  display: flex;
  margin-top: 2px;
}

/* Progress bar (Grid) */
.progress-bar-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}
.progress-bar {
  flex: 1;
  height: 4px;
  background: rgb(var(--v-theme-surface-variant));
  border-radius: 2px;
  overflow: hidden;
}
.progress-bar-sm {
  height: 3px;
  min-width: 40px;
  max-width: 60px;
}
.progress-fill {
  height: 100%;
  background: rgb(var(--v-theme-primary));
  border-radius: 2px;
  transition: width 0.3s ease;
}
.progress-text {
  flex-shrink: 0;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.6;
}

/* ========== List View ========== */
.books-list {
  flex: 1;
  overflow-y: auto;
}
.list-item-selected {
  background: rgba(var(--v-theme-primary), 0.06) !important;
}

.list-cover-wrapper {
  width: 36px;
  height: 48px;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 4px;
}
.list-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.list-cover-ph {
  display: flex;
  align-items: center;
  justify-content: center;
}

.list-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}
.progress-bar-wrap-small {
  display: flex;
  align-items: center;
}

/* ========== Bottom Bar ========== */
.bottom-bar {
  flex-shrink: 0;
  border-top: 1px solid rgb(var(--v-theme-border));
  background: rgb(var(--v-theme-surface));
  min-height: 28px;
}

/* ========== Floating Batch Action Bar ========== */
.floating-batch-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgb(var(--v-theme-primary));
  color: #fff;
  padding: 8px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.25);
}

/* ========== Import Dialog ========== */
.import-drop-zone {
  border: 2px dashed rgb(var(--v-theme-border));
  border-radius: 10px;
  padding: 28px 16px;
  text-align: center;
  transition: border-color 0.2s, background 0.2s;
}
.import-drop-zone-active {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.04);
}

/* ========== Detail Dialog ========== */
.detail-cover {
  width: 120px;
  flex-shrink: 0;
}
.detail-cover-img {
  width: 100%;
  aspect-ratio: 3/4;
  object-fit: cover;
  border-radius: 8px;
  display: block;
}
.detail-cover-ph {
  display: flex;
  align-items: center;
  justify-content: center;
}
.flex-1 {
  flex: 1;
}
.gap-4 {
  gap: 16px;
}

/* ========== Misc ========== */
.border-b {
  border-bottom: 1px solid rgb(var(--v-theme-border)) !important;
}
.border-t {
  border-top: 1px solid rgb(var(--v-theme-border)) !important;
}
.border {
  border: 1px solid rgb(var(--v-theme-border));
}
.rounded {
  border-radius: 6px;
}
.bg-surface-variant {
  background: rgb(var(--v-theme-surface-variant));
}

/* ========== Import History Panel ========== */
.import-history-panel {
  flex-shrink: 0;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgb(var(--v-theme-border));
}
.import-history-panel .v-list {
  background: transparent;
}

/* ========== Pagination Nav ========== */
.pagination-bar {
  flex-shrink: 0;
  padding: 8px 16px;
  border-top: 1px solid rgb(var(--v-theme-border));
  background: rgb(var(--v-theme-surface));
}
.page-btn {
  min-width: 28px !important;
  padding: 0 2px !important;
}
</style>
