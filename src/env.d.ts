export {}

interface ElectronAPIBooks {
  getAll: (opts?: { limit?: number; offset?: number }) => Promise<any>
  getById: (id: string) => Promise<any>
  insert: (book: any) => Promise<any>
  update: (id: string, updates: any) => Promise<any>
  delete: (ids: string[]) => Promise<{ success: boolean; failed: number }>
  count: () => Promise<number>
}

interface ElectronAPIConfig {
  get: (key: string) => Promise<string | null | undefined>
  set: (key: string, value: string) => Promise<void>
  delete: (key: string) => Promise<void>
  getAll: () => Promise<Array<{ k: string; v: string }>>
}

interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  isMaximized: () => Promise<boolean>
  close: () => void
  isVisible: () => Promise<boolean>
  openFiles: () => Promise<{ canceled: boolean; filePaths: string[] }>
  openFile: (opts?: any) => Promise<{ canceled: boolean; filePaths: string[] }>
  openFolder: () => Promise<{ canceled: boolean; folderPath: string }>
  saveFile: (opts?: any) => Promise<{ canceled: boolean; filePath: string }>
  readFile: (path: string) => Promise<{ success: boolean; data: ArrayBuffer; name: string; error?: string }>
  readBatchFiles: (paths: string[]) => Promise<Array<{ name: string; data: ArrayBuffer; error?: string }>>
  fileStats: (paths: string[]) => Promise<Array<{ name: string; size: number; path?: string; error?: string }>>
  writeFile: (path: string, data: ArrayBuffer) => Promise<{ success: boolean }>
  openExternal: (url: string) => Promise<string>
  getPath: () => Promise<string>
  setAutoStart: (v: boolean) => Promise<void>
  getAutoStart: () => Promise<boolean>
  setStartMinimized: (v: boolean) => Promise<void>
  getStartMinimized: () => Promise<boolean>
  getShortcuts: () => Promise<Record<string, string>>
  setShortcut: (key: string, value: string) => Promise<boolean>
  onToggleTheme: (cb: () => void) => Promise<() => void>
  onCommandPalette: (cb: () => void) => Promise<() => void>
  onMinimizedToTray: () => () => void
  onWindowShown: (cb: (v: boolean) => void) => () => void
  clearCache: () => Promise<void>
  showMessageBox: (opts: any) => Promise<{ response: number }>
  showMessage: (title: string, message: string) => Promise<void>
  books: ElectronAPIBooks
  chapters: any
  rawFile: any
  meta: {
    toArray: () => Promise<any[]>
    put: (bid: string, data: string) => Promise<void>
    bulkPut: (entries: any[]) => Promise<void>
    bulkDelete: (ids: string[]) => Promise<void>
    count: () => Promise<number>
    get: (bid: string) => Promise<any>
  }
  config: ElectronAPIConfig
  bookmarks: any
  annotations: any
  trash: any
  libraries: any
  clearAll: () => Promise<any>
  cleanupOrphans: () => Promise<any>
  parseBook: (path: string) => Promise<any>
  importBook: (path: string) => Promise<any>
  search: (q: string) => Promise<any>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
    __xr_native_titlebar?: boolean
  }
}
