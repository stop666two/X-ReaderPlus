// API Bridge — Wails runtime + HTTP JSON backend (Go) on port 34123
// SECURITY NOTE (H-4): Browser dev mode stores config in localStorage (plaintext).
// Production uses SQLite via Go backend. Never use browser dev mode with real data.

export const BASE = 'http://127.0.0.1:34123'

declare global {
  interface Window {
    go?: {
      main: {
        App: {
          Minimize: () => void
          Maximize: () => void
          IsMaximized: () => Promise<boolean>
          Close: () => void
          OpenFiles: () => Promise<FileInfo[]>
          OpenFile: () => Promise<FileInfo | null>
          OpenFolder: () => Promise<string>
          SaveFile: (fileName: string, data: string) => Promise<string>
          OpenExternal: (url: string) => Promise<string>
          ReadFile: (path: string) => Promise<FileInfo>
          GetAppDir: () => Promise<string>
          ShowMessage: (title: string, message: string) => Promise<void>
          FileSizes: (paths: string[]) => Promise<FileInfo[]>
        }
      }
    }
    runtime?: {
      WindowMinimise: () => void
      WindowMaximise: () => void
      WindowUnmaximise: () => void
      WindowIsMaximised: () => Promise<boolean>
      Quit: () => void
      BrowserOpenURL: (url: string) => void
    }
    electronAPI?: any
  }
}

interface FileInfo {
  path: string
  name: string
  data?: number[] | string
  error?: string
  size?: number
}

const API_TIMEOUT = 30000 // 30s timeout for all API calls

async function api<T = any>(method: string, path: string, body?: any, rawBody?: string): Promise<T> {
  const h: Record<string, string> = {}
  if (body !== undefined || rawBody !== undefined) { h['Content-Type'] = 'application/json' }
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)
  try {
    const opts: RequestInit = { method, headers: h, signal: controller.signal, body: rawBody !== undefined ? rawBody : (body !== undefined ? JSON.stringify(body) : undefined) }
    const res = await fetch(BASE + path, opts)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || res.statusText)
    }
    return res.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

function toCamel(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(toCamel)
  if (typeof obj !== 'object') return obj
  const out: any = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = toCamel(v)
  }
  return out
}

function toSnake(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(toSnake)
  if (typeof obj !== 'object') return obj
  const out: any = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k.replace(/[A-Z]/g, (c, offset) => offset > 0 ? '_' + c.toLowerCase() : c.toLowerCase())] = toSnake(v)
  }
  return out
}

// File dialog + read cache (LRU, max 50 entries)
const MAX_CACHED_FILES = 50
let _cachedFiles: Array<{ name: string; data: ArrayBuffer; error?: string }> = []

function addToCache(file: { name: string; data: ArrayBuffer; error?: string }) {
  const idx = _cachedFiles.findIndex(f => f.name === file.name)
  if (idx >= 0) _cachedFiles.splice(idx, 1)
  _cachedFiles.unshift(file)
  if (_cachedFiles.length > MAX_CACHED_FILES) _cachedFiles = _cachedFiles.slice(0, MAX_CACHED_FILES)
}

function findInCache(name: string): { name: string; data: ArrayBuffer; error?: string } | undefined {
  const idx = _cachedFiles.findIndex(f => f.name === name)
  if (idx < 0) return undefined
  const f = _cachedFiles[idx]
  if (idx > 0) { _cachedFiles.splice(idx, 1); _cachedFiles.unshift(f) }
  return f
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as ArrayBuffer)
    r.onerror = () => reject(new Error('Read failed'))
    r.readAsArrayBuffer(file)
  })
}

function removeSafe(el: HTMLElement) {
  try { if (el.parentNode) el.parentNode.removeChild(el) } catch {}
}

async function pickAndReadFiles(multiple: boolean): Promise<{ canceled: boolean; filePaths: string[] }> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = multiple
    input.style.position = 'fixed'
    input.style.top = '-100px'
    input.style.left = '-100px'
    document.body.appendChild(input)

    let settled = false
    const finish = (canceled: boolean, paths: string[]) => {
      if (settled) return
      settled = true
      removeSafe(input)
      resolve({ canceled, filePaths: paths })
    }

    input.onchange = async () => {
      const files = Array.from(input.files || [])
      if (files.length === 0) { finish(true, []); return }
      _cachedFiles = []
      for (const f of files) {
        try {
          const data = await readFileAsArrayBuffer(f)
          addToCache({ name: f.name, data })
        } catch (e) {
          addToCache({ name: f.name, data: new ArrayBuffer(0), error: String(e) })
        }
      }
      finish(false, files.map(f => (f as any).path || f.name))
    }

    // Fallback: if dialog closes without change (user clicked cancel)
    window.addEventListener('focus', function onFocus() {
      window.removeEventListener('focus', onFocus)
      setTimeout(() => {
        if (!settled) finish(true, [])
      }, 500)
    }, { once: true })

    input.click()
  })
}

async function pickFolder(): Promise<{ canceled: boolean; folderPath: string }> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.webkitdirectory = true
    input.style.position = 'fixed'
    input.style.top = '-100px'
    input.style.left = '-100px'
    document.body.appendChild(input)

    let settled = false
    const finish = (canceled: boolean, path: string) => {
      if (settled) return
      settled = true
      removeSafe(input)
      resolve({ canceled, folderPath: path })
    }

    input.onchange = async () => {
      const files = Array.from(input.files || [])
      _cachedFiles = []
      for (const f of files) {
        try {
          addToCache({ name: f.name, data: await readFileAsArrayBuffer(f) })
        } catch (e) {
          addToCache({ name: f.name, data: new ArrayBuffer(0), error: String(e) })
        }
      }
      const firstPath = files.length > 0 ? ((files[0] as any).path || files[0].name) : ''
      const dirPath = firstPath ? firstPath.substring(0, Math.max(firstPath.lastIndexOf('\\'), firstPath.lastIndexOf('/'))) : ''
      finish(false, dirPath)
    }

    window.addEventListener('focus', function onFocus() {
      window.removeEventListener('focus', onFocus)
      setTimeout(() => { if (!settled) finish(true, '') }, 500)
    }, { once: true })

    input.click()
  })
}

function useWails(): boolean {
  return !!(window.go?.main?.App)
}

function wailsOrFallback<T>(wailsFn: () => T, fallback: () => T): T {
  return useWails() ? wailsFn() : fallback()
}

function wailsBytesToBuffer(data: number[] | string): ArrayBuffer {
  if (!data || (Array.isArray(data) && data.length === 0) || (typeof data === 'string' && !data)) return new ArrayBuffer(0)
  let bytes: Uint8Array
  if (typeof data === 'string') {
    const bin = atob(data)
    bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  } else {
    bytes = new Uint8Array(data)
  }
  return bytes.buffer as ArrayBuffer
}

const apiObj: any = {
  minimize: () => wailsOrFallback(
    () => { window.go!.main.App.Minimize() },
    () => {},
  ),
  maximize: () => wailsOrFallback(
    () => { window.go!.main.App.Maximize() },
    () => {},
  ),
  isMaximized: () => wailsOrFallback(
    () => window.go!.main.App.IsMaximized(),
    () => Promise.resolve(false),
  ),
  close: () => wailsOrFallback(
    () => { window.go!.main.App.Close() },
    () => { if (window.close) window.close() },
  ),
  isVisible: () => Promise.resolve(true),

  openFiles: async () => wailsOrFallback(
    async () => {
      const files = await window.go!.main.App.OpenFiles()
      _cachedFiles = files
        .filter(f => !f.error && f.data)
        .map(f => ({ name: f.name, data: wailsBytesToBuffer(f.data!) }))
      return { canceled: false, filePaths: files.map(f => f.path) }
    },
    async () => pickAndReadFiles(true),
  ),
  openFile: async () => wailsOrFallback(
    async () => {
      const f = await window.go!.main.App.OpenFile()
      if (!f) return { canceled: true, filePaths: [] }
      _cachedFiles = [{ name: f.name, data: wailsBytesToBuffer(f.data!) }]
      return { canceled: false, filePaths: [f.path] }
    },
    async () => pickAndReadFiles(false),
  ),
  openFolder: async () => wailsOrFallback(
    async () => {
      const p = await window.go!.main.App.OpenFolder()
      return { canceled: !p, folderPath: p }
    },
    async () => pickFolder(),
  ),
  saveFile: async (opts?: any) => {
    if (useWails()) {
      const data = opts?.data || ''
      let b64: string
      if (typeof data === 'string') {
        const bytes = new TextEncoder().encode(data)
        let bin = ''
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
        b64 = btoa(bin)
      } else {
        const bytes = new Uint8Array(data)
        let bin = ''
        const chunk = 8192
        for (let i = 0; i < bytes.length; i += chunk) {
          const c = bytes.subarray(i, Math.min(i + chunk, bytes.length))
          let s = ''
          for (let j = 0; j < c.length; j++) s += String.fromCharCode(c[j])
          bin += s
        }
        b64 = btoa(bin)
      }
      const path = await window.go!.main.App.SaveFile(opts?.defaultPath || 'export.json', b64)
      return { canceled: !path, filePath: path }
    }
    const blob = new Blob([opts?.data || ''], { type: opts?.type || 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = opts?.defaultPath || 'export.json'
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    return { canceled: false, filePath: opts?.defaultPath || '' }
  },
  showMessageBox: async (opts: any) => {
    if (useWails()) {
      await window.go!.main.App.ShowMessage(opts?.title || '', opts?.message || '')
      return { response: 0 }
    }
    alert(opts?.message || '')
    return { response: 0 }
  },

  readFile: async (filePath: string) => {
    if (useWails()) {
      const info = await window.go!.main.App.ReadFile(filePath)
      if (info.error) return { success: false, data: new ArrayBuffer(0), name: '', error: info.error }
      return { success: true, data: wailsBytesToBuffer(info.data!), name: info.name }
    }
    const name = filePath.split(/[/\\]/).pop() || filePath
    const f = findInCache(name)
    if (f) return { success: true, data: f.data, name: f.name }
    return { success: false, data: new ArrayBuffer(0), name: '', error: 'Not found' }
  },
  readBatchFiles: async (paths: string[]) => {
    if (useWails()) {
      const results: Array<{ name: string; data: ArrayBuffer; error?: string }> = []
      for (const p of paths) {
        const info = await window.go!.main.App.ReadFile(p)
        if (!info.error && info.data) {
          results.push({ name: info.name, data: wailsBytesToBuffer(info.data!) })
        } else {
          results.push({ name: info.name || p, data: new ArrayBuffer(0), error: info.error || 'Read failed' })
        }
      }
      return results
    }
    return paths.map(p => {
      const n = p.split(/[/\\]/).pop() || p
      return findInCache(n) || findInCache(p) || { name: n, data: new ArrayBuffer(0), error: 'Not found' }
    })
  },
  fileStats: async (paths: string[]) => {
    if (useWails()) {
      const infos = await window.go!.main.App.FileSizes(paths)
      return infos.map((info: any) => info.error ? { name: info.name, path: info.path, size: 0, error: info.error } : { name: info.name, path: info.path, size: info.size })
    }
    return paths.map(p => {
      const n = p.split(/[/\\]/).pop() || p
      const f = findInCache(n)
      return f ? { name: f.name, size: f.data.byteLength } : { name: n, size: 0, error: 'Not found' }
    })
  },
  writeFile: async (filePath: string, data: ArrayBuffer) => {
    if (useWails()) {
      const name = filePath.split(/[/\\]/).pop() || 'file'
      const bytes = new Uint8Array(data)
      let bin = ''
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
      const b64 = btoa(bin)
      await window.go!.main.App.SaveFile(name, b64)
      return { success: true }
    }
    const blob = new Blob([data])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filePath.split(/[/\\]/).pop() || 'file'
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    return { success: true }
  },

  getPath: async () => {
    if (useWails()) return await window.go!.main.App.GetAppDir()
    return ''
  },
  setAutoStart: async () => false,
  getAutoStart: async () => false,
  getStartMinimized: async () => false,
  setStartMinimized: async () => false,
  clearCache: async () => { _cachedFiles = [] },
  getShortcuts: async () => ({}),
  setShortcut: async () => false,

  onToggleTheme: async (cb: any) => {
    const h = (e: KeyboardEvent) => { if (e.ctrlKey && e.key === 't') { e.preventDefault(); cb() } }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  },
  onCommandPalette: async (cb: any) => {
    const h = (e: KeyboardEvent) => { if (e.ctrlKey && e.key === 'k') { e.preventDefault(); cb() } }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  },
  onMinimizedToTray: () => () => {},
  onWindowShown: (cb: any) => { cb(true); return () => {} },

  books: {
    getAll: (opts?: any) => {
      const page = Math.floor((opts?.offset || 0) / (opts?.limit || 30)) + 1
      return api('GET', `/api/books?page=${page}&pageSize=${opts?.limit || 30}`)
        .then((r: any) => {
        const rows = toCamel(Array.isArray(r) ? r[0] : r)
        const total = Array.isArray(r) ? r[1] : null
        return total != null ? { rows, total } : rows
      })
    },
    getById: (id: string) => api('GET', `/api/books/${id}`).then(r => toCamel(r)),
    insert: (book: any) => api('POST', '/api/books', book),
    update: (id: string, updates: any) => api('PUT', `/api/books/${id}`, toSnake(updates)),
    delete: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((id: string) => api('DELETE', `/api/books/${id}`)))
      const failed = results.filter(r => r.status === 'rejected').length
      return { success: failed === 0, failed }
    },
    count: () => api('GET', '/api/books/count'),
  },
  chapters: {
    get: (bookId: string) => api('GET', `/api/chapters/${bookId}`).then(r => JSON.stringify(r ?? [])),
    set: (bookId: string, data: string) => api('POST', `/api/chapters/${bookId}`, undefined, `{"chapters":${data}}`),
    delete: (bookId: string) => api('DELETE', `/api/chapters/${bookId}`),
    getAll: async () => {
      try {
        const r = await api('GET', '/api/books?page=1&pageSize=10000')
        const books = (Array.isArray(r) ? r[0] : []) || []
        const results: any[] = []
        for (const b of books) {
          try {
            const data = await api('GET', `/api/chapters/${b.id}`)
            if (data) results.push({ bid: b.id, data: JSON.stringify(data) })
          } catch { /* skip books without chapters */ }
        }
        return results
      } catch { return [] }
    },
  },
  // Raw file storage for export
  rawFile: {
    save: (bookId: string, filename: string, data: ArrayBuffer) => {
      const bytes = new Uint8Array(data)
      const chunkSize = 8192
      let b64 = ''
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
        let bin = ''
        for (let j = 0; j < chunk.length; j++) bin += String.fromCharCode(chunk[j])
        b64 += btoa(bin)
      }
      return api('POST', `/api/raw/${bookId}`, { filename, data: b64 })
    },
    get: (bookId: string) => api('GET', `/api/raw/${bookId}`),
    delete: (bookId: string) => api('DELETE', `/api/raw/${bookId}`),
  },
  config: {
    get: (key: string) => api('GET', `/api/config/${key}`),
    set: (key: string, value: string) => api('POST', '/api/config', { key, value }),
    delete: (key: string) => api('DELETE', `/api/config/${key}`),
    getAll: async () => {
      try {
        // Config keys are known; fetch individually
        const keys = ['theme_mode', 'app_settings', 'pin_state', 'reading_history', 'reading_stats', 'shortcuts', 'privacy_locks']
        const results: any[] = []
        for (const k of keys) {
          try {
            const v = await api('GET', `/api/config/${k}`)
            if (v !== null && v !== undefined) results.push({ k, v: typeof v === 'string' ? v : JSON.stringify(v) })
          } catch { /* skip missing keys */ }
        }
        return results
      } catch { return [] }
    },
  },
  // Meta table — proxied through books API
  meta: {
    toArray: async () => {
      try {
        const r = await api('GET', '/api/books?page=1&pageSize=10000')
        const books = (Array.isArray(r) ? r[0] : []) || []
        return books.map((b: any) => ({ bid: b.id, data: JSON.stringify(b) }))
      } catch { return [] }
    },
    put: async (bid: string, data: string) => { /* no-op: meta is derived from books */ },
    bulkPut: async () => {},
    bulkDelete: async () => {},
    count: async () => {
      try { return await api('GET', '/api/books/count') } catch { return 0 }
    },
    get: async (bid: string) => {
      try {
        const b = await api('GET', `/api/books/${bid}`)
        return b ? { bid: b.id, data: JSON.stringify(b) } : null
      } catch { return null }
    },
  },
  bookmarks: {
    getByBook: (bookId: string) => api('GET', `/api/bookmarks?bookId=${encodeURIComponent(bookId)}`).then((bms: any) => (bms || []).map((b: any) => ({ id: b.id, data: typeof b.data === 'string' ? b.data : JSON.stringify(b.data) }))),
    getAll: () => api('GET', '/api/bookmarks').then((bms: any) => (bms || []).map((b: any) => ({ id: b.id, data: typeof b.data === 'string' ? b.data : JSON.stringify(b.data) }))),
    insert: (_id: string, data: string) => {
      let parsed: any; try { parsed = JSON.parse(data) } catch { return Promise.reject(new Error('Invalid bookmark JSON')) }
      return api('POST', '/api/bookmarks', { bookmark: parsed })
    },
    delete: (id: string) => api('DELETE', `/api/bookmarks/${encodeURIComponent(id)}`),
  },
  annotations: {
    getByBook: (bookId: string) => api('GET', `/api/annotations?bookId=${encodeURIComponent(bookId)}`).then((anns: any) => (anns || []).map((a: any) => ({ id: a.id, data: typeof a.data === 'string' ? a.data : JSON.stringify(a.data) }))),
    getAll: () => api('GET', '/api/annotations').then((anns: any) => (anns || []).map((a: any) => ({ id: a.id, data: typeof a.data === 'string' ? a.data : JSON.stringify(a.data) }))),
    insert: (_id: string, data: string) => {
      let parsed: any; try { parsed = JSON.parse(data) } catch { return Promise.reject(new Error('Invalid annotation JSON')) }
      return api('POST', '/api/annotations', { annotation: parsed })
    },
    update: (_id: string, data: string) => {
      let parsed: any; try { parsed = JSON.parse(data) } catch { return Promise.reject(new Error('Invalid annotation JSON')) }
      return api('PUT', `/api/annotations/${encodeURIComponent(_id)}`, { annotation: parsed })
    },
    delete: (id: string) => api('DELETE', `/api/annotations/${encodeURIComponent(id)}`),
  },
  trash: {
    get: (id: string) => api('GET', '/api/trash').then((items: any) => (items || []).find((i: any) => i.id === id)),
    getAll: () => api('GET', '/api/trash').then((items: any) => (items || []).map((i: any) => ({ id: i.id, data: typeof i.data === 'string' ? i.data : JSON.stringify(i.data) }))),
    insert: (_id: string, data: string) => {
      let parsed: any; try { parsed = JSON.parse(data) } catch { return Promise.reject(new Error('Invalid trash item JSON')) }
      return api('POST', '/api/trash', { item: parsed })
    },
    delete: (id: string) => api('DELETE', `/api/trash/${encodeURIComponent(id)}`),
    permanentDelete: (id: string) => api('DELETE', `/api/trash/${encodeURIComponent(id)}`),
    batchPermanentDelete: (ids: string[]) => Promise.all(ids.map((id: string) => api('DELETE', `/api/trash/${encodeURIComponent(id)}`))),
    clear: () => api('DELETE', '/api/trash'),
  },
  libraries: {
    getAll: () => api('GET', '/api/libraries').then((libs: any) => (libs || []).map((l: any) => ({ id: l.id, data: typeof l.data === 'string' ? l.data : JSON.stringify(l.data) }))),
    insert: (_id: string, data: string) => {
      let parsed: any; try { parsed = JSON.parse(data) } catch { return Promise.reject(new Error('Invalid library JSON')) }
      return api('POST', '/api/libraries', { library: parsed })
    },
    delete: (id: string) => api('DELETE', `/api/libraries/${encodeURIComponent(id)}`),
  },
  clearAll: () => api('DELETE', '/api/clear'),
  cleanupOrphans: () => api('DELETE', '/api/cleanup-orphans'),
  parseBook: (path: string) => api('POST', '/api/parse', { filePath: path }),
  importBook: (path: string) => api('POST', '/api/import', { filePath: path }),
  search: (q: string) => api('GET', `/api/search?q=${encodeURIComponent(q)}`),
}

;(window as any).electronAPI = apiObj
console.log('[API Bridge] Ready')
