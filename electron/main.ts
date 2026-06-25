import { app, BrowserWindow, globalShortcut, ipcMain, dialog, protocol, net, Tray, Menu, nativeImage, session } from 'electron'
import { join, resolve, sep } from 'path'
import * as fs from 'fs'
import { promises as fsPromises } from 'fs'
import { db, closeDb } from '../src/services/sqlite-db'

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, m => '_' + m.toLowerCase())
}

// Single-instance lock
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
let isBossMode = false
let tray: Tray | null = null
let isQuitting = false

// Persisted config
const configPath = join(app.getPath('userData'), 'config.json')

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized: boolean
}

interface AppConfig {
  startMinimized: boolean
  windowState?: WindowState
}

function loadConfig(): AppConfig {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    }
  } catch (e) { console.error('Failed to load config:', e) }
  return { startMinimized: false }
}

function saveConfig(config: AppConfig) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  } catch (e) { console.error('Failed to save config:', e) }
}

let appConfig = loadConfig()

// Stored shortcut key bindings (can be changed via IPC)
const shortcutBindings: Record<string, string> = {
  bossKey: 'Ctrl+B',
  toggleTheme: 'Ctrl+T',
  commandPalette: 'Ctrl+K'
}

// 最小有效的 32x32 蓝色 PNG（蓝色书本简化版）
const ICON_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAbZJREFUWEftlr1KA0EUhe9sFE0h4kMois9gIVhYWPkAPoEvoK9gY2NhY2FjYaFYaCGIhc8gWIg/EEFNNpvMnWsxhN3szk42xj1wGNidO98c7tw7M+BPQtQ/pzBPgb8EmDMBDxcXlUfu+/0PADS8BHEcN3ulEl2ngB1E4hHXx2OMoijh3nXb77Vm9ggA3HX7pFmvbqA8O40K4q3/cfhSoH3dAwAAUq39MXXgtqtwgFo7OTANr9wG0vAgV0eTvS28BJAEnnD5BXANIQHPAfaQAQB1QCgAjiQkfYcgAPcApAE6ENrrFcAlQAIHyoAvH0oCBSBuAb/0TdpQErfHhwNvfy9ARzHrDaDcAm8JSYCeAJBgb9+9AE+A9wRCgNkB5iME4Az0DKB3QgIwBsAtMFOt0Y8zlgNULsC2B/oDKIcgxVUNSM0QTO5CXwEsAIGeEMgI8AkgU4M3wGLoJQhSVEgAqduXFuB2CaavbgrMtVQBtlAyHFRiRLgHxhA4BxyrNg8VBNBLJoHrGcJ0ALb0uQFO1ZLGUJ4KgTAKTELCA/e5hj9WXv2wLhnKFyZpVp2AjwAAAABJRU5ErkJggg=='
const appIcon = nativeImage.createFromDataURL(`data:image/png;base64,${ICON_PNG_BASE64}`)

function createWindow() {
  const savedState = appConfig.windowState

  const winOpts: Electron.BrowserWindowConstructorOptions = {
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#121212',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    },
    icon: appIcon,
    show: false
  }

  if (savedState) {
    winOpts.width = savedState.width
    winOpts.height = savedState.height
    if (savedState.x !== undefined) winOpts.x = savedState.x
    if (savedState.y !== undefined) winOpts.y = savedState.y
  } else {
    winOpts.width = 1280
    winOpts.height = 800
  }

  mainWindow = new BrowserWindow(winOpts)

  if (savedState?.isMaximized) {
    mainWindow.maximize()
  }

  mainWindow.once('ready-to-show', () => {
    // Check if launched via auto-start with --hidden flag
    const wasAutoStarted = process.argv.includes('--hidden')
    if (wasAutoStarted && appConfig.startMinimized) {
      // Stay hidden — only tray icon visible
    } else if (!appConfig.startMinimized) {
      mainWindow?.show()
    }
    mainWindow?.webContents?.send('window:shown', mainWindow?.isVisible() ?? false)
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  // Security: Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (_e, url) => {
    if (!url.startsWith('app://') && !url.startsWith('local://')) {
      _e.preventDefault()
    }
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  // Minimize to tray instead of closing
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      saveWindowState()
      mainWindow?.hide()
      mainWindow?.webContents?.send('window:minimized-to-tray')
    }
  })

  mainWindow.on('closed', () => {
    // Clean up event listeners to prevent memory leaks
    mainWindow?.removeListener('resize', debounceSaveWindowState)
    mainWindow?.removeListener('move', debounceSaveWindowState)
    mainWindow?.removeListener('maximize', saveWindowState)
    mainWindow?.removeListener('unmaximize', saveWindowState)
    mainWindow = null
  })

  // Persist window state on changes
  mainWindow.on('resize', debounceSaveWindowState)
  mainWindow.on('move', debounceSaveWindowState)
  mainWindow.on('maximize', saveWindowState)
  mainWindow.on('unmaximize', saveWindowState)

}

// registerShortcuts / registerIPC are now called once on app startup (not per window)

let saveTimeout: NodeJS.Timeout | null = null

function debounceSaveWindowState() {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(saveWindowState, 300)
}

function saveWindowState() {
  if (!mainWindow) return
  try {
    const bounds = mainWindow.getBounds()
    appConfig.windowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: mainWindow.isMaximized()
    }
    saveConfig(appConfig)
  } catch (e) { console.error('Failed to save window state:', e) }
}

function createTray() {
  const trayIcon = appIcon.resize({ width: 16, height: 16 })

  tray = new Tray(trayIcon)
  tray.setToolTip('X-ReaderPlus')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        } else {
          appConfig.startMinimized = false
          createWindow()
        }
      }
    },
    {
      label: '隐藏窗口',
      click: () => {
        mainWindow?.hide()
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        saveWindowState()
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  // Double-click tray icon restores window
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    } else {
      appConfig.startMinimized = false
      createWindow()
    }
  })
}

let registeredShortcutIds: string[] = []

function registerShortcuts() {
  // Unregister all first
  registeredShortcutIds.forEach(id => {
    try { globalShortcut.unregister(id) } catch (e) { console.error('Failed to unregister shortcut:', id, e) }
  })
  registeredShortcutIds = []

  // Boss key
  try {
    globalShortcut.register(shortcutBindings.bossKey, () => {
      if (mainWindow) {
        isBossMode = !isBossMode
        if (isBossMode) {
          mainWindow.hide()
        } else {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    })
    registeredShortcutIds.push(shortcutBindings.bossKey)
  } catch (e) { console.error('Failed to register boss key:', e) }

  // Toggle theme
  try {
    globalShortcut.register(shortcutBindings.toggleTheme, () => {
      mainWindow?.webContents?.send('shortcut:toggle-theme')
    })
    registeredShortcutIds.push(shortcutBindings.toggleTheme)
  } catch (e) { console.error('Failed to register toggle-theme:', e) }

  // Command palette
  try {
    globalShortcut.register(shortcutBindings.commandPalette, () => {
      mainWindow?.webContents?.send('shortcut:command-palette')
    })
    registeredShortcutIds.push(shortcutBindings.commandPalette)
  } catch (e) { console.error('Failed to register command-palette:', e) }
}

function registerIPC() {
  // Window controls
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) { mainWindow.unmaximize() } else { mainWindow?.maximize() }
  })
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:isVisible', () => mainWindow?.isVisible() ?? false)

  // ── Auto-start ──
  ipcMain.handle('app:setAutoStart', (_event, enable: boolean) => {
    app.setLoginItemSettings({
      openAtLogin: enable,
      args: enable ? ['--hidden'] : []
    })
    return app.getLoginItemSettings().openAtLogin
  })

  ipcMain.handle('app:getAutoStart', () => {
    return app.getLoginItemSettings().openAtLogin
  })

  // ── Start minimized ──
  ipcMain.handle('app:getStartMinimized', () => appConfig.startMinimized)

  ipcMain.handle('app:setStartMinimized', (_event, value: boolean) => {
    appConfig.startMinimized = value
    saveConfig(appConfig)
    return appConfig.startMinimized
  })

  // ── Cache clearing ──
  ipcMain.handle('app:clearCache', async () => {
    try {
      await session.defaultSession.clearCache()
      await session.defaultSession.clearStorageData()
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // File open dialogs
  ipcMain.handle('dialog:openFiles', async (_event, options) => {
    if (!mainWindow) return { canceled: true, filePaths: [] }
    return dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: options?.filters || [{
        name: '电子书',
        extensions: ['epub','txt','md','markdown','html','htm','mobi','azw','azw3','fb2','djvu','docx','rtf','odt','pdf','cbr','cbz','cbt','cb7']
      }]
    })
  })

  ipcMain.handle('dialog:openFile', async (_event, options) => {
    if (!mainWindow) return { canceled: true, filePaths: [] }
    return dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: options?.filters
    })
  })

  ipcMain.handle('dialog:openFolder', async (_event, _options) => {
    if (!mainWindow) return { canceled: true, folderPath: '' }
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })
    return { canceled: result.canceled, folderPath: result.filePaths[0] || '' }
  })

  ipcMain.handle('dialog:saveFile', async (_event, options) => {
    if (!mainWindow) return { canceled: true, filePath: '' }
    return dialog.showSaveDialog(mainWindow, options)
  })

  ipcMain.handle('dialog:showMessageBox', async (_event, options) => {
    if (!mainWindow) return { response: -1 }
    return dialog.showMessageBox(mainWindow, options)
  })

  ipcMain.handle('app:getPath', (_event, name: string) => {
    // Only expose whitelisted paths to renderer
    const ALLOWED_PATHS = new Set(['userData', 'appData', 'temp', 'downloads', 'desktop', 'documents'])
    if (!ALLOWED_PATHS.has(name)) return ''
    return app.getPath(name as any)
  })

  // ── File I/O (required for book import) ──
  function isValidFilePath(filePath: string): boolean {
    if (!filePath || typeof filePath !== 'string') return false
    if (/\.\./.test(filePath)) return false
    const resolved = resolve(filePath)
    const normalized = resolved.replace(/\\/g, '/')
    // Block Windows system directories
    if (/^[A-Za-z]:\/Windows(\/|$)/i.test(normalized)) return false
    if (/^[A-Za-z]:\/Program Files(\/|$)/i.test(normalized)) return false
    if (/^[A-Za-z]:\/Program Files \(x86\)(\/|$)/i.test(normalized)) return false
    if (/^\/System(32|64)/i.test(normalized)) return false
    // NOTE: C:\Users is NOT blocked — users commonly store books in Downloads, Documents, Desktop
    // %APPDATA% subdirectories are blocked below to prevent traversal of app data
    if (/Recycle\.Bin/i.test(normalized)) return false
    if (/System Volume Information/i.test(normalized)) return false
    // Block %APPDATA% equivalent paths
    try {
      const userData = app.getPath('userData').replace(/\\/g, '/').replace(/[^/]+$/, '')
      if (normalized.startsWith(userData)) return false
    } catch { /* ignore — userData might not resolve in test envs */ }
    return true
  }

  ipcMain.handle('file:read', async (_event, filePath: string) => {
    if (!isValidFilePath(filePath)) return { success: false, error: 'Invalid file path' }
    try {
      const buffer = await fsPromises.readFile(filePath)
      return { success: true, data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), name: filePath.split(/[\\/]/).pop() || filePath }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('file:stats', async (_event, filePaths: string[]) => {
    const results: Array<{ name: string; size: number; error?: string }> = []
    for (const fp of filePaths) {
      if (!isValidFilePath(fp)) {
        results.push({ name: fp.split(/[\\/]/).pop() || fp, size: 0, error: 'Invalid file path' })
        continue
      }
      try {
        const stat = await fsPromises.stat(fp)
        results.push({ name: fp.split(/[\\/]/).pop() || fp, size: stat.size })
      } catch (e: any) {
        results.push({ name: fp.split(/[\\/]/).pop() || fp, size: 0, error: e.message })
      }
    }
    return results
  })

  ipcMain.handle('file:readBatch', async (_event, filePaths: string[]) => {
    const results: Array<{ name: string; data: ArrayBuffer; error?: string }> = []
    for (const fp of filePaths) {
      if (!isValidFilePath(fp)) {
        results.push({ name: fp.split(/[\\/]/).pop() || fp, data: new ArrayBuffer(0), error: 'Invalid file path' })
        continue
      }
      try {
        const buffer = await fsPromises.readFile(fp)
        results.push({ name: fp.split(/[\\/]/).pop() || fp, data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) })
      } catch (e: any) {
        results.push({ name: fp.split(/[\\/]/).pop() || fp, data: new ArrayBuffer(0), error: e.message })
      }
    }
    return results
  })

  ipcMain.handle('file:write', async (_event, filePath: string, data: ArrayBuffer) => {
    if (!isValidFilePath(filePath)) return { success: false, error: 'Invalid file path' }
    try {
      await fsPromises.writeFile(filePath, Buffer.from(data))
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // ── Safe IPC handler wrapper ──
  // Wraps DB handlers with error handling. Returns { success: false, error } on failure.
  function safeHandler(fn: (...args: any[]) => any) {
    return async (...args: any[]) => {
      try {
        return await fn(...args)
      } catch (e: any) {
        console.error('IPC handler error:', e.message)
        return { success: false, error: e.message }
      }
    }
  }

  // ── Database: Books ──
  ipcMain.handle('db:books:getAll', safeHandler(async (_e, opts?: { limit?: number; offset?: number }) => {
    const limit = opts?.limit ?? 30
    const offset = opts?.offset ?? 0
    const rows = db.prepare('SELECT * FROM books ORDER BY added_at DESC LIMIT ? OFFSET ?').all(limit, offset)
    return rows
  }))
  ipcMain.handle('db:books:getById', safeHandler(async (_e, id: string) => {
    const row = db.prepare('SELECT * FROM books WHERE id = ?').get(id)
    return row || null
  }))
  ipcMain.handle('db:books:insert', safeHandler(async (_e, book: any) => {
    db.prepare(`INSERT OR REPLACE INTO books (id,title,author,cover,path,format,size,added_at,last_read_at,progress,chapter_index,chapter_progress,tags,rating,review,word_count,chapter_count,total_reading_time,library_id,content_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      book.id ?? '', book.title ?? '', book.author ?? '未知作者', book.cover ?? '', book.path ?? '', book.format ?? 'txt', book.size ?? 0, book.addedAt ?? Date.now(), book.lastReadAt ?? 0, book.progress ?? 0, book.chapterIndex ?? 0, book.chapterProgress ?? 0, JSON.stringify(book.tags||[]), book.rating ?? 0, book.review ?? '', book.wordCount ?? 0, book.chapterCount ?? 0, book.totalReadingTime ?? 0, book.libraryId ?? 'default', book.contentHash ?? ''
    )
  }))
  // Whitelist of columns that can be updated via IPC
  const ALLOWED_BOOK_UPDATE_COLUMNS = new Set([
    'title', 'author', 'cover', 'progress', 'chapterIndex', 'chapterProgress',
    'tags', 'rating', 'review', 'lastReadAt', 'totalReadingTime', 'libraryId',
    'wordCount', 'chapterCount', 'contentHash'
  ])

  ipcMain.handle('db:books:update', safeHandler(async (_e, id: string, updates: any) => {
    const sets: string[] = []
    const vals: any[] = []
    for (const [k,v] of Object.entries(updates)) {
      if (!ALLOWED_BOOK_UPDATE_COLUMNS.has(k)) continue
      const col = camelToSnake(k)
      sets.push(`${col} = ?`)
      vals.push(k === 'tags' ? JSON.stringify(v||[]) : v)
    }
    if (sets.length === 0) return
    vals.push(id)
    db.prepare(`UPDATE books SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  }))
  ipcMain.handle('db:books:delete', safeHandler(async (_e, ids: string[]) => {
    const stmt = db.prepare('DELETE FROM books WHERE id = ?')
    const del = db.transaction(() => { for (const id of ids) stmt.run(id) })
    del()
  }))
  ipcMain.handle('db:books:count', safeHandler(async () => (db.prepare('SELECT COUNT(*) as cnt FROM books').get() as any).cnt))

  // ── Database: Chapters ──
  ipcMain.handle('db:chapters:get', safeHandler(async (_e, bookId: string) => {
    const row = db.prepare('SELECT data FROM chapters WHERE book_id = ?').get(bookId) as any
    return row ? row.data : null
  }))
  ipcMain.handle('db:chapters:set', safeHandler(async (_e, bookId: string, data: string) => {
    db.prepare('INSERT OR REPLACE INTO chapters (book_id, data) VALUES (?, ?)').run(bookId, data)
  }))
  ipcMain.handle('db:chapters:delete', safeHandler(async (_e, bookId: string) => {
    db.prepare('DELETE FROM chapters WHERE book_id = ?').run(bookId)
  }))
  ipcMain.handle('db:chapters:getAll', safeHandler(async () => {
    return db.prepare('SELECT * FROM chapters').all()
  }))

  // ── Database: Config ──
  ipcMain.handle('db:config:get', safeHandler(async (_e, key: string) => {
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key) as any
    return row ? row.value : null
  }))
  ipcMain.handle('db:config:set', safeHandler(async (_e, key: string, value: string) => {
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, value)
  }))
  ipcMain.handle('db:config:delete', safeHandler(async (_e, key: string) => {
    db.prepare('DELETE FROM config WHERE key = ?').run(key)
  }))
  ipcMain.handle('db:config:getAll', safeHandler(async () => {
    return db.prepare('SELECT key, value FROM config').all()
  }))

  // ── Database: Bookmarks ──
  ipcMain.handle('db:bookmarks:getByBook', safeHandler(async (_e, bookId: string) => {
    return db.prepare("SELECT * FROM bookmarks WHERE json_extract(data, '$.bookId') = ?").all(bookId)
  }))
  ipcMain.handle('db:bookmarks:getAll', safeHandler(async () => {
    return db.prepare('SELECT * FROM bookmarks').all()
  }))
  ipcMain.handle('db:bookmarks:insert', safeHandler(async (_e, id: string, data: string) => {
    db.prepare('INSERT OR REPLACE INTO bookmarks (id, data) VALUES (?, ?)').run(id, data)
  }))
  ipcMain.handle('db:bookmarks:delete', safeHandler(async (_e, id: string) => {
    db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id)
  }))

  // ── Database: Annotations ──
  ipcMain.handle('db:annotations:get', safeHandler(async (_e, id: string) => {
    return db.prepare('SELECT * FROM annotations WHERE id = ?').get(id) || null
  }))
  ipcMain.handle('db:annotations:getByBook', safeHandler(async (_e, bookId: string) => {
    return db.prepare("SELECT * FROM annotations WHERE json_extract(data, '$.bookId') = ?").all(bookId)
  }))
  ipcMain.handle('db:annotations:getAll', safeHandler(async () => {
    return db.prepare('SELECT * FROM annotations').all()
  }))
  ipcMain.handle('db:annotations:insert', safeHandler(async (_e, id: string, data: string) => {
    db.prepare('INSERT OR REPLACE INTO annotations (id, data) VALUES (?, ?)').run(id, data)
  }))
  ipcMain.handle('db:annotations:update', safeHandler(async (_e, id: string, data: string) => {
    db.prepare('UPDATE annotations SET data = ? WHERE id = ?').run(data, id)
  }))
  ipcMain.handle('db:annotations:delete', safeHandler(async (_e, id: string) => {
    db.prepare('DELETE FROM annotations WHERE id = ?').run(id)
  }))

  // ── Database: Trash ──
  ipcMain.handle('db:trash:get', safeHandler(async (_e, id: string) => {
    return db.prepare('SELECT * FROM trash WHERE id = ?').get(id) || null
  }))
  ipcMain.handle('db:trash:getAll', safeHandler(async () => db.prepare('SELECT * FROM trash').all()))
  ipcMain.handle('db:trash:insert', safeHandler(async (_e, id: string, data: string) => {
    db.prepare('INSERT OR REPLACE INTO trash (id, data) VALUES (?, ?)').run(id, data)
  }))
  ipcMain.handle('db:trash:delete', safeHandler(async (_e, id: string) => {
    db.prepare('DELETE FROM trash WHERE id = ?').run(id)
  }))
  ipcMain.handle('db:trash:permanentDelete', safeHandler(async (_e, id: string) => {
    const trashRow = db.prepare('SELECT data FROM trash WHERE id = ?').get(id) as any
    if (!trashRow) return
    const trashData = JSON.parse(trashRow.data)
    const bookId = trashData.book?.id || trashData.id
    const del = db.transaction(() => {
      db.prepare('DELETE FROM trash WHERE id = ?').run(id)
      db.prepare('DELETE FROM chapters WHERE book_id = ?').run(bookId)
      db.prepare("DELETE FROM bookmarks WHERE json_extract(data, '$.bookId') = ?").run(bookId)
      db.prepare("DELETE FROM annotations WHERE json_extract(data, '$.bookId') = ?").run(bookId)
    })
    del()
    try {
      const imgDir = join(app.getPath('userData'), 'cbz-images', bookId)
      await fsPromises.rm(imgDir, { recursive: true, force: true })
    } catch { /* best-effort cleanup */ }
  }))
  ipcMain.handle('db:trash:batchPermanentDelete', safeHandler(async (_e, ids: string[]) => {
    for (const id of ids) {
      const trashRow = db.prepare('SELECT data FROM trash WHERE id = ?').get(id) as any
      if (!trashRow) continue
      const trashData = JSON.parse(trashRow.data)
      const bookId = trashData.book?.id || trashData.id
      db.transaction(() => {
        db.prepare('DELETE FROM trash WHERE id = ?').run(id)
        db.prepare('DELETE FROM chapters WHERE book_id = ?').run(bookId)
        db.prepare("DELETE FROM bookmarks WHERE json_extract(data, '$.bookId') = ?").run(bookId)
        db.prepare("DELETE FROM annotations WHERE json_extract(data, '$.bookId') = ?").run(bookId)
      })()
      try {
        const imgDir = join(app.getPath('userData'), 'cbz-images', bookId)
        await fsPromises.rm(imgDir, { recursive: true, force: true })
      } catch { /* best-effort cleanup */ }
    }
  }))
  ipcMain.handle('db:trash:clear', safeHandler(async () => {
    const allTrash = db.prepare('SELECT * FROM trash').all() as any[]
    for (const row of allTrash) {
      try {
        const trashData = JSON.parse(row.data)
        const bookId = trashData.book?.id || trashData.id
        db.prepare('DELETE FROM chapters WHERE book_id = ?').run(bookId)
        db.prepare("DELETE FROM bookmarks WHERE json_extract(data, '$.bookId') = ?").run(bookId)
        db.prepare("DELETE FROM annotations WHERE json_extract(data, '$.bookId') = ?").run(bookId)
        try {
          const imgDir = join(app.getPath('userData'), 'cbz-images', bookId)
          await fsPromises.rm(imgDir, { recursive: true, force: true })
        } catch { /* best-effort cleanup */ }
      } catch { /* skip malformed trash entries */ }
    }
    db.prepare('DELETE FROM trash').run()
  }))

  // ── Database: Libraries ──
  ipcMain.handle('db:libraries:getAll', safeHandler(async () => db.prepare('SELECT * FROM libraries').all()))
  ipcMain.handle('db:libraries:insert', safeHandler(async (_e, id: string, data: string) => {
    db.prepare('INSERT OR REPLACE INTO libraries (id, data) VALUES (?, ?)').run(id, data)
  }))
  ipcMain.handle('db:libraries:delete', safeHandler(async (_e, id: string) => {
    db.prepare('DELETE FROM libraries WHERE id = ?').run(id)
  }))

  // ── Database: Clear all ──
  ipcMain.handle('db:clearAll', safeHandler(async (_e, confirm?: string) => {
    if (confirm !== 'CONFIRM') {
      throw new Error('需要二次确认参数')
    }
    db.exec('DELETE FROM books; DELETE FROM chapters; DELETE FROM config; DELETE FROM bookmarks; DELETE FROM annotations; DELETE FROM trash; DELETE FROM libraries')
    try {
      const imgRoot = join(app.getPath('userData'), 'cbz-images')
      await fsPromises.rm(imgRoot, { recursive: true, force: true })
    } catch { /* best-effort cache cleanup */ }
  }))

  // Shortcut management
  ipcMain.handle('shortcuts:get', () => ({ ...shortcutBindings }))

  ipcMain.handle('shortcuts:set', (_event, key: string, binding: string) => {
    if (shortcutBindings[key] !== undefined) {
      shortcutBindings[key] = binding
      registerShortcuts()
      return true
    }
    return false
  })

  // ── CBZ/Comic image storage ──
  ipcMain.handle('cbz:saveImage', async (_e, bookId: string, index: number, data: ArrayBuffer, ext: string) => {
    try {
      const dir = join(app.getPath('userData'), 'cbz-images', bookId)
      await fsPromises.mkdir(dir, { recursive: true })
      const filePath = join(dir, `page-${index}.${ext}`)
      await fsPromises.writeFile(filePath, Buffer.from(data))
      return { success: true, path: filePath }
    } catch (e: any) {
      console.error('cbz:saveImage failed:', e.message)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('cbz:deleteImages', async (_e, bookId: string) => {
    try {
      const dir = join(app.getPath('userData'), 'cbz-images', bookId)
      await fsPromises.rm(dir, { recursive: true, force: true })
      return { success: true }
    } catch (e: any) {
      console.error('cbz:deleteImages failed:', e.message)
      return { success: false, error: e.message }
    }
  })
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  { scheme: 'local', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
])

// Global error handlers to prevent silent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason)
})

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const url = new URL(request.url)
    // Strip leading slash so path.join doesn't reset; validate no traversal escapes dist/
    const relativePath = url.pathname.replace(/^\/+/, '')
    const distRoot = resolve(__dirname, '../dist')
    const safePath = resolve(distRoot, relativePath)
    if (!safePath.startsWith(distRoot + sep) && safePath !== distRoot) {
      return new Response('Access denied', { status: 403 })
    }
    return net.fetch(`file://${safePath}`)
  })

  // local:// protocol — serves cached CBZ/comic images from userData
  protocol.handle('local', (request) => {
    const url = new URL(request.url)
    const relativePath = url.pathname.replace(/^\/+/, '')
    const userDataRoot = app.getPath('userData')
    const safePath = resolve(userDataRoot, relativePath)
    if (!safePath.startsWith(userDataRoot + sep) && safePath !== userDataRoot) {
      return new Response('Access denied', { status: 403 })
    }
    return net.fetch(`file://${safePath}`)
  })

  registerShortcuts()
  registerIPC()
  createTray()
  createWindow()
})

app.on('window-all-closed', () => {
  // Don't quit — the app lives in the tray
  // Only clean up shortcuts; actual quit happens via tray menu
})

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
  } else if (BrowserWindow.getAllWindows().length === 0) {
    appConfig.startMinimized = false
    createWindow()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  saveWindowState()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  tray?.destroy()
  closeDb()
})
