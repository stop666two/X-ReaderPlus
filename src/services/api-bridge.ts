// API Bridge — HTTP JSON backend (Go) on port 34123

const BASE = 'http://127.0.0.1:34123'

async function api<T = any>(method: string, path: string, body?: any): Promise<T> {
  const h: Record<string, string> = {}
  if (body !== undefined) { h['Content-Type'] = 'application/json' }
  const opts: RequestInit = { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined }
  const res = await fetch(BASE + path, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
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
    out[k.replace(/[A-Z]/g, c => '_' + c.toLowerCase())] = toSnake(v)
  }
  return out
}

// File dialog + read cache
let _cachedFiles: Array<{ name: string; data: ArrayBuffer; error?: string }> = []

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
          _cachedFiles.push({ name: f.name, data })
        } catch (e) {
          _cachedFiles.push({ name: f.name, data: new ArrayBuffer(0), error: String(e) })
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
          _cachedFiles.push({ name: f.name, data: await readFileAsArrayBuffer(f) })
        } catch (e) {
          _cachedFiles.push({ name: f.name, data: new ArrayBuffer(0), error: String(e) })
        }
      }
      finish(false, files.length > 0 ? ((files[0] as any).path || files[0].name) : '')
    }

    window.addEventListener('focus', function onFocus() {
      window.removeEventListener('focus', onFocus)
      setTimeout(() => { if (!settled) finish(true, '') }, 500)
    }, { once: true })

    input.click()
  })
}

const apiObj: any = {
  minimize: () => {},
  maximize: () => {},
  isMaximized: () => Promise.resolve(false),
  close: () => { if (window.close) window.close() },
  isVisible: () => Promise.resolve(true),

  openFiles: async () => pickAndReadFiles(true),
  openFile: async () => pickAndReadFiles(false),
  openFolder: async () => pickFolder(),
  saveFile: async (opts?: any) => {
    // Browser download fallback
    const blob = new Blob([opts?.data || ''], { type: opts?.type || 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = opts?.defaultPath || 'export.json'
    a.click(); URL.revokeObjectURL(url)
    return { canceled: false, filePath: opts?.defaultPath || '' }
  },
  showMessageBox: async (opts: any) => { alert(opts.message); return { response: 0 } },

  readFile: async (filePath: string) => {
    const name = filePath.split(/[/\\]/).pop() || filePath
    const f = _cachedFiles.find(x => x.name === name)
    if (f) return { success: true, data: f.data, name: f.name }
    return { success: false, data: new ArrayBuffer(0), name: '', error: 'Not found' }
  },
  readBatchFiles: async (paths: string[]) => {
    return _cachedFiles.filter(f => paths.some(p => {
      const n = p.split(/[/\\]/).pop() || p
      return f.name === n || p === f.name
    }))
  },
  fileStats: async (paths: string[]) => {
    return paths.map(p => {
      const n = p.split(/[/\\]/).pop() || p
      const f = _cachedFiles.find(x => x.name === n)
      return f ? { name: f.name, size: f.data.byteLength } : { name: n, size: 0, error: 'Not found' }
    })
  },
  writeFile: async (filePath: string, data: ArrayBuffer) => {
    const blob = new Blob([data])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filePath.split(/[/\\]/).pop() || 'file'
    a.click(); URL.revokeObjectURL(url)
    return { success: true }
  },

  getPath: async () => '',
  setAutoStart: async () => false,
  getAutoStart: async () => false,
  getStartMinimized: async () => false,
  setStartMinimized: async () => false,
  clearCache: async () => _cachedFiles = [],
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
        .then((r: any) => toCamel(Array.isArray(r) ? r[0] : r))
    },
    getById: (id: string) => api('GET', `/api/books/${id}`).then(r => toCamel(r)),
    insert: (book: any) => api('POST', '/api/books', book),
    update: (id: string, updates: any) => api('PUT', `/api/books/${id}`, toSnake(updates)),
    delete: (ids: string[]) => Promise.all(ids.map((id: string) => api('DELETE', `/api/books/${id}`))),
    count: () => api('GET', '/api/books/count'),
  },
  chapters: {
    get: (bookId: string) => api('GET', `/api/chapters/${bookId}`).then(r => JSON.stringify(r ?? [])),
    set: (bookId: string, data: string) => api('POST', `/api/chapters/${bookId}`, { chapters: JSON.parse(data) }),
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
      let b64 = ''
      for (let i = 0; i < bytes.length; i++) b64 += String.fromCharCode(bytes[i])
      return api('POST', `/api/raw/${bookId}`, { filename, data: btoa(b64) })
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
    insert: (_id: string, data: string) => api('POST', '/api/bookmarks', { bookmark: JSON.parse(data) }),
    delete: (id: string) => api('DELETE', `/api/bookmarks/${encodeURIComponent(id)}`),
  },
  annotations: {
    getByBook: (bookId: string) => api('GET', `/api/annotations?bookId=${encodeURIComponent(bookId)}`).then((anns: any) => (anns || []).map((a: any) => ({ id: a.id, data: typeof a.data === 'string' ? a.data : JSON.stringify(a.data) }))),
    getAll: () => api('GET', '/api/annotations').then((anns: any) => (anns || []).map((a: any) => ({ id: a.id, data: typeof a.data === 'string' ? a.data : JSON.stringify(a.data) }))),
    insert: (_id: string, data: string) => api('POST', '/api/annotations', { annotation: JSON.parse(data) }),
    update: (_id: string, data: string) => api('PUT', `/api/annotations/${encodeURIComponent(_id)}`, { annotation: JSON.parse(data) }),
    delete: (id: string) => api('DELETE', `/api/annotations/${encodeURIComponent(id)}`),
  },
  trash: {
    get: (id: string) => api('GET', '/api/trash').then((items: any) => (items || []).find((i: any) => i.id === id)),
    getAll: () => api('GET', '/api/trash').then((items: any) => (items || []).map((i: any) => ({ id: i.id, data: typeof i.data === 'string' ? i.data : JSON.stringify(i.data) }))),
    insert: (_id: string, data: string) => api('POST', '/api/trash', { item: JSON.parse(data) }),
    delete: (id: string) => api('DELETE', `/api/trash/${encodeURIComponent(id)}`),
    permanentDelete: (id: string) => api('DELETE', `/api/trash/${encodeURIComponent(id)}`),
    batchPermanentDelete: (ids: string[]) => Promise.all(ids.map((id: string) => api('DELETE', `/api/trash/${encodeURIComponent(id)}`))),
    clear: () => api('DELETE', '/api/trash'),
  },
  libraries: {
    getAll: () => api('GET', '/api/libraries').then((libs: any) => (libs || []).map((l: any) => ({ id: l.id, data: typeof l.data === 'string' ? l.data : JSON.stringify(l.data) }))),
    insert: (_id: string, data: string) => api('POST', '/api/libraries', { library: JSON.parse(data) }),
    delete: (id: string) => api('DELETE', `/api/libraries/${encodeURIComponent(id)}`),
  },
  clearAll: () => api('DELETE', '/api/clear'),
  parseBook: (path: string) => api('POST', '/api/parse', { filePath: path }),
  importBook: (path: string) => api('POST', '/api/import', { filePath: path }),
  search: (q: string) => api('GET', `/api/search?q=${encodeURIComponent(q)}`),
}

;(window as any).electronAPI = apiObj
console.log('[API Bridge] Ready')
