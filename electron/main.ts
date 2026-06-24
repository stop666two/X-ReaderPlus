import { app, BrowserWindow, globalShortcut, ipcMain, dialog, protocol, net, Tray, Menu, nativeImage, session } from 'electron'
import { join, resolve, sep } from 'path'
import * as fs from 'fs'

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
    icon: join(__dirname, '../public/icon.png'),
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
    mainWindow = null
  })

  // Persist window state on changes
  mainWindow.on('resize', debounceSaveWindowState)
  mainWindow.on('move', debounceSaveWindowState)
  mainWindow.on('maximize', saveWindowState)
  mainWindow.on('unmaximize', saveWindowState)

  registerShortcuts()
  registerIPC()
}

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
  const iconPath = join(__dirname, '../public/icon.png')
  let trayIcon: Electron.NativeImage
  try {
    trayIcon = nativeImage.createFromPath(iconPath)
    trayIcon = trayIcon.resize({ width: 16, height: 16 })
  } catch {
    trayIcon = nativeImage.createEmpty()
  }

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
  // ── Path validation helper ──
  // Reject paths that point outside user‑accessible locations or to system directories
  function isValidFilePath(filePath: string): boolean {
    if (!filePath || typeof filePath !== 'string') return false
    const normalized = filePath.replace(/\\/g, '/')
    // Block access to Windows system roots
    if (/^\/Windows/i.test(normalized)) return false
    if (/^\/System(32|64)/i.test(normalized)) return false
    if (/^\/boot/i.test(normalized)) return false
    if (/^\/etc/i.test(normalized)) return false
    if (/^\/dev/i.test(normalized)) return false
    if (/^\/proc/i.test(normalized)) return false
    if (/^\/sys/i.test(normalized)) return false
    return true
  }

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

  ipcMain.handle('app:getPath', (_event, name: string) => app.getPath(name as any))

  // File reading (critical for import)
  ipcMain.handle('file:read', async (_event, filePath: string) => {
    if (!isValidFilePath(filePath)) return { success: false, error: 'Invalid file path' }
    try {
      const buffer = fs.readFileSync(filePath)
      return { success: true, data: buffer.buffer, name: filePath.split(/[\\/]/).pop() || filePath }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('file:stats', async (_event, filePaths: string[]) => {
    const results: Array<{ name: string; size: number; error?: string }> = []
    for (const fp of filePaths) {
      try {
        const stat = fs.statSync(fp)
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
        const buffer = fs.readFileSync(fp)
        results.push({ name: fp.split(/[\\/]/).pop() || fp, data: buffer.buffer })
      } catch (e: any) {
        results.push({ name: fp.split(/[\\/]/).pop() || fp, data: new ArrayBuffer(0), error: e.message })
      }
    }
    return results
  })

  ipcMain.handle('file:write', async (_event, filePath: string, data: ArrayBuffer) => {
    if (!isValidFilePath(filePath)) return { success: false, error: 'Invalid file path' }
    try {
      fs.writeFileSync(filePath, Buffer.from(data))
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

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
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
])

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

app.on('will-quit', () => { globalShortcut.unregisterAll() })
