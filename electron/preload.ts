import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  close: () => ipcRenderer.invoke('window:close'),
  isVisible: () => ipcRenderer.invoke('window:isVisible'),

  // File dialogs
  openFiles: (options?: any) => ipcRenderer.invoke('dialog:openFiles', options),
  openFile: (options?: any) => ipcRenderer.invoke('dialog:openFile', options),
  openFolder: (options?: any) => ipcRenderer.invoke('dialog:openFolder', options),
  saveFile: (options?: any) => ipcRenderer.invoke('dialog:saveFile', options),
  showMessageBox: (options: any) => ipcRenderer.invoke('dialog:showMessageBox', options),

  // File I/O
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  readBatchFiles: (filePaths: string[]) => ipcRenderer.invoke('file:readBatch', filePaths),
  fileStats: (filePaths: string[]) => ipcRenderer.invoke('file:stats', filePaths),
  writeFile: (filePath: string, data: ArrayBuffer) => ipcRenderer.invoke('file:write', filePath, data),

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
