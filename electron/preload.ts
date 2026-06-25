import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  close: () => ipcRenderer.invoke('window:close'),
  isVisible: () => ipcRenderer.invoke('window:isVisible'),

  // File I/O
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  readBatchFiles: (filePaths: string[]) => ipcRenderer.invoke('file:readBatch', filePaths),
  fileStats: (filePaths: string[]) => ipcRenderer.invoke('file:stats', filePaths),
  writeFile: (filePath: string, data: ArrayBuffer) => ipcRenderer.invoke('file:write', filePath, data),

  // File dialogs
  openFiles: (options?: any) => ipcRenderer.invoke('dialog:openFiles', options),
  openFile: (options?: any) => ipcRenderer.invoke('dialog:openFile', options),
  openFolder: (options?: any) => ipcRenderer.invoke('dialog:openFolder', options),
  saveFile: (options?: any) => ipcRenderer.invoke('dialog:saveFile', options),
  showMessageBox: (options: any) => ipcRenderer.invoke('dialog:showMessageBox', options),

  // Database
  books: {
    getAll: (opts?: { limit?: number; offset?: number }) => ipcRenderer.invoke('db:books:getAll', opts),
    getById: (id: string) => ipcRenderer.invoke('db:books:getById', id),
    insert: (book: any) => ipcRenderer.invoke('db:books:insert', book),
    update: (id: string, updates: any) => ipcRenderer.invoke('db:books:update', id, updates),
    delete: (ids: string[]) => ipcRenderer.invoke('db:books:delete', ids),
    count: () => ipcRenderer.invoke('db:books:count'),
  },
  chapters: {
    get: (bookId: string) => ipcRenderer.invoke('db:chapters:get', bookId),
    set: (bookId: string, data: string) => ipcRenderer.invoke('db:chapters:set', bookId, data),
    delete: (bookId: string) => ipcRenderer.invoke('db:chapters:delete', bookId),
    getAll: () => ipcRenderer.invoke('db:chapters:getAll'),
  },
  config: {
    get: (key: string) => ipcRenderer.invoke('db:config:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('db:config:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('db:config:delete', key),
    getAll: () => ipcRenderer.invoke('db:config:getAll'),
  },
  bookmarks: {
    getByBook: (bookId: string) => ipcRenderer.invoke('db:bookmarks:getByBook', bookId),
    getAll: () => ipcRenderer.invoke('db:bookmarks:getAll'),
    insert: (id: string, data: string) => ipcRenderer.invoke('db:bookmarks:insert', id, data),
    delete: (id: string) => ipcRenderer.invoke('db:bookmarks:delete', id),
  },
  annotations: {
    get: (id: string) => ipcRenderer.invoke('db:annotations:get', id),
    getByBook: (bookId: string) => ipcRenderer.invoke('db:annotations:getByBook', bookId),
    getAll: () => ipcRenderer.invoke('db:annotations:getAll'),
    insert: (id: string, data: string) => ipcRenderer.invoke('db:annotations:insert', id, data),
    update: (id: string, data: string) => ipcRenderer.invoke('db:annotations:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('db:annotations:delete', id),
  },
  trash: {
    get: (id: string) => ipcRenderer.invoke('db:trash:get', id),
    getAll: () => ipcRenderer.invoke('db:trash:getAll'),
    insert: (id: string, data: string) => ipcRenderer.invoke('db:trash:insert', id, data),
    delete: (id: string) => ipcRenderer.invoke('db:trash:delete', id),
    permanentDelete: (id: string) => ipcRenderer.invoke('db:trash:permanentDelete', id),
    batchPermanentDelete: (ids: string[]) => ipcRenderer.invoke('db:trash:batchPermanentDelete', ids),
    clear: () => ipcRenderer.invoke('db:trash:clear'),
  },
  libraries: {
    getAll: () => ipcRenderer.invoke('db:libraries:getAll'),
    insert: (id: string, data: string) => ipcRenderer.invoke('db:libraries:insert', id, data),
    delete: (id: string) => ipcRenderer.invoke('db:libraries:delete', id),
  },
  clearAll: () => ipcRenderer.invoke('db:clearAll', 'CONFIRM'),

  // CBZ/Comic image cache
  cbzSaveImage: (bookId: string, index: number, data: ArrayBuffer, ext: string) =>
    ipcRenderer.invoke('cbz:saveImage', bookId, index, data, ext),
  cbzDeleteImages: (bookId: string) => ipcRenderer.invoke('cbz:deleteImages', bookId),

  // App paths
  getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),

  // Auto-start
  setAutoStart: (enable: boolean) => ipcRenderer.invoke('app:setAutoStart', enable),
  getAutoStart: () => ipcRenderer.invoke('app:getAutoStart'),

  // Start minimized
  getStartMinimized: () => ipcRenderer.invoke('app:getStartMinimized'),
  setStartMinimized: (value: boolean) => ipcRenderer.invoke('app:setStartMinimized', value),

  // Cache
  clearCache: () => ipcRenderer.invoke('app:clearCache'),

  // Shortcuts
  getShortcuts: () => ipcRenderer.invoke('shortcuts:get'),
  setShortcut: (key: string, binding: string) => ipcRenderer.invoke('shortcuts:set', key, binding),

  // Shortcut event listeners
  onToggleTheme: (callback: () => void) => {
    ipcRenderer.on('shortcut:toggle-theme', callback)
    return () => ipcRenderer.removeListener('shortcut:toggle-theme', callback)
  },
  onCommandPalette: (callback: () => void) => {
    ipcRenderer.on('shortcut:command-palette', callback)
    return () => ipcRenderer.removeListener('shortcut:command-palette', callback)
  },

  // Tray event listeners
  onMinimizedToTray: (callback: () => void) => {
    ipcRenderer.on('window:minimized-to-tray', callback)
    return () => ipcRenderer.removeListener('window:minimized-to-tray', callback)
  },
  onWindowShown: (callback: (visible: boolean) => void) => {
    const handler = (_event: any, visible: boolean) => callback(visible)
    ipcRenderer.on('window:shown', handler)
    return () => ipcRenderer.removeListener('window:shown', handler)
  }
})
