export {}

declare global {
  interface Window {
    electronAPI?: {
      // Window
      minimize: () => Promise<void>
      maximize: () => Promise<void>
      isMaximized: () => Promise<boolean>
      close: () => Promise<void>
      isVisible: () => Promise<boolean>
      // Dialogs
      openFiles: (options?: any) => Promise<{ canceled: boolean; filePaths: string[] }>
      openFile: (options?: any) => Promise<{ canceled: boolean; filePaths: string[] }>
      saveFile: (options?: any) => Promise<{ canceled: boolean; filePath: string }>
      showMessageBox: (options: any) => Promise<{ response: number }>
      // File I/O
      readFile: (filePath: string) => Promise<{ success: boolean; data: ArrayBuffer; name: string; error?: string }>
      readBatchFiles: (filePaths: string[]) => Promise<Array<{ name: string; data: ArrayBuffer; error?: string }>>
      fileStats: (filePaths: string[]) => Promise<Array<{ name: string; size: number; error?: string }>>
      writeFile: (filePath: string, data: ArrayBuffer) => Promise<{ success: boolean; error?: string }>
      // System
      getPath: (name: string) => Promise<string>
      setAutoStart: (enable: boolean) => Promise<boolean>
      getAutoStart: () => Promise<boolean>
      getStartMinimized: () => Promise<boolean>
      setStartMinimized: (value: boolean) => Promise<boolean>
      clearCache: () => Promise<{ success: boolean; error?: string }>
      getShortcuts: () => Promise<Record<string, string>>
      setShortcut: (key: string, binding: string) => Promise<boolean>
      openFolder?: () => Promise<{ canceled: boolean; folderPath?: string }>
      // Events
      onToggleTheme: (callback: () => void) => () => void
      onCommandPalette: (callback: () => void) => () => void
      onMinimizedToTray: (callback: () => void) => () => void
      onWindowShown: (callback: (visible: boolean) => void) => () => void
      // Database (SQLite IPC)
      books: {
        getAll: (opts?: { limit?: number; offset?: number }) => Promise<any[]>
        getById: (id: string) => Promise<any>
        insert: (book: any) => Promise<void>
        update: (id: string, updates: any) => Promise<void>
        delete: (ids: string[]) => Promise<void>
        count: () => Promise<number>
      }
      chapters: {
        get: (bookId: string) => Promise<string | null>
        set: (bookId: string, data: string) => Promise<void>
        delete: (bookId: string) => Promise<void>
        getAll: () => Promise<any[]>
      }
      config: {
        get: (key: string) => Promise<string | null>
        set: (key: string, value: string) => Promise<void>
        delete: (key: string) => Promise<void>
        getAll: () => Promise<Array<{ key: string; value: string }>>
      }
      bookmarks: {
        getByBook: (bookId: string) => Promise<any[]>
        getAll: () => Promise<any[]>
        insert: (id: string, data: string) => Promise<void>
        delete: (id: string) => Promise<void>
      }
      annotations: {
        get: (id: string) => Promise<any>
        getByBook: (bookId: string) => Promise<any[]>
        getAll: () => Promise<any[]>
        insert: (id: string, data: string) => Promise<void>
        update: (id: string, data: string) => Promise<void>
        delete: (id: string) => Promise<void>
      }
      trash: {
        get: (id: string) => Promise<any>
        getAll: () => Promise<any[]>
        insert: (id: string, data: string) => Promise<void>
        delete: (id: string) => Promise<void>
        permanentDelete: (id: string) => Promise<void>
        batchPermanentDelete: (ids: string[]) => Promise<void>
        clear: () => Promise<void>
      }
      libraries: {
        getAll: () => Promise<any[]>
        insert: (id: string, data: string) => Promise<void>
        delete: (id: string) => Promise<void>
      }
      clearAll: () => Promise<{ success: boolean; error?: string }>
      // CBZ/Comic image cache
      cbzSaveImage: (bookId: string, index: number, data: ArrayBuffer, ext: string) => Promise<{ success: boolean; path?: string; error?: string }>
      cbzDeleteImages: (bookId: string) => Promise<{ success: boolean; error?: string }>
    }
  }
}
