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
      // Auto-start
      setAutoStart: (enable: boolean) => Promise<boolean>
      getAutoStart: () => Promise<boolean>
      // Start minimized
      getStartMinimized: () => Promise<boolean>
      setStartMinimized: (value: boolean) => Promise<boolean>
      // Cache
      clearCache: () => Promise<{ success: boolean; error?: string }>
      // Shortcuts
      getShortcuts: () => Promise<Record<string, string>>
      setShortcut: (key: string, binding: string) => Promise<boolean>
      // Folder
      openFolder?: () => Promise<{ canceled: boolean; folderPath?: string }>
      // Events
      onToggleTheme: (callback: () => void) => () => void
      onCommandPalette: (callback: () => void) => () => void
      onMinimizedToTray: (callback: () => void) => () => void
      onWindowShown: (callback: (visible: boolean) => void) => () => void
    }
  }
}
