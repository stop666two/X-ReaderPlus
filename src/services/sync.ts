import { uploadFile, downloadFile, hasEncryptionKey, encryptPassword, decryptPassword } from './webdav'

const SYNC_FILE = 'x-readerplus-sync.json'
interface SyncEntry {
  bookId: string
  chapterIndex: number
  chapterProgress: number
  progress: number
  updatedAt: number
}

interface SyncManifest {
  version: number
  deviceId: string
  entries: Record<string, SyncEntry>
  lastSyncAt: number
}

function getDeviceId(): string {
  let id = localStorage.getItem('xrp_device_id')
  if (!id) {
    id = 'device-' + Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2, '0')).join('')
    localStorage.setItem('xrp_device_id', id)
  }
  return id
}

let _webdavUrl = ''
let _webdavUser = ''
let _webdavPass = ''

export function setSyncCredentials(url: string, username: string, password: string): void {
  _webdavUrl = url
  _webdavUser = username
  _webdavPass = password
}

export function hasSyncCredentials(): boolean {
  return !!(localStorage.getItem('sync_webdav_url'))
}

const SYNC_CFG_KEY = 'webdav_sync'
function syncCfgGet(key: string): Promise<string | null> {
  if (typeof window !== 'undefined' && window.electronAPI?.config) {
    return window.electronAPI.config.get(key).then((v: string | undefined | null) => v ?? null)
  }
  return Promise.resolve(localStorage.getItem(key))
}
function syncCfgSet(key: string, value: string): Promise<void> {
  if (typeof window !== 'undefined' && window.electronAPI?.config) {
    return window.electronAPI.config.set(key, value)
  }
  localStorage.setItem(key, value)
  return Promise.resolve()
}
function syncCfgDel(key: string): Promise<void> {
  if (typeof window !== 'undefined' && window.electronAPI?.config) {
    return window.electronAPI.config.delete(key)
  }
  localStorage.removeItem(key)
  return Promise.resolve()
}

export async function loadSyncCredentials(): Promise<{ url: string; username: string; password: string }> {
  try {
    const raw = await syncCfgGet(SYNC_CFG_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      _webdavUrl = data.url || ''
      _webdavUser = data.username || ''
      let password = data.password || ''
      if (password && password.startsWith('{')) {
        try {
          const enc = JSON.parse(password)
          if (enc.iv && enc.ciphertext) {
            const hasKey = await hasEncryptionKey().catch(() => false)
            if (hasKey) password = await decryptPassword(enc.iv, enc.ciphertext)
          }
        } catch {}
      }
      _webdavPass = password
      return { url: data.url || '', username: data.username || '', password }
    }
  } catch (e) {
    console.warn('[sync] loadSyncCredentials failed', e)
  }
  return { url: '', username: '', password: '' }
}

export async function saveSyncCredentials(url: string, username: string, password: string): Promise<void> {
  _webdavUrl = url
  _webdavUser = username
  _webdavPass = password
  let stored = { url, username, password }
  const hasKey = await hasEncryptionKey().catch(() => false)
  if (hasKey && password) {
    try {
      const enc = await encryptPassword(password)
      stored = { url, username, password: JSON.stringify(enc) }
    } catch {}
  }
  await syncCfgSet(SYNC_CFG_KEY, JSON.stringify(stored))
}

export async function clearSyncCredentials(): Promise<void> {
  _webdavUrl = ''
  _webdavUser = ''
  _webdavPass = ''
  await syncCfgDel(SYNC_CFG_KEY)
}

async function loadManifest(): Promise<SyncManifest | null> {
  try {
    const data = await downloadFile(_webdavUrl, _webdavUser, _webdavPass, SYNC_FILE)
    const text = new TextDecoder().decode(data)
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function saveManifest(manifest: SyncManifest): Promise<void> {
  const json = JSON.stringify(manifest)
  const data = new TextEncoder().encode(json)
  await uploadFile(_webdavUrl, _webdavUser, _webdavPass, SYNC_FILE, data.buffer)
}

export async function pushReadingProgress(
  bookId: string,
  chapterIndex: number,
  chapterProgress: number,
  progress: number
): Promise<void> {
  if (!_webdavUrl) return
  try {
    const manifest = await loadManifest() || { version: 1, deviceId: getDeviceId(), entries: {}, lastSyncAt: 0 }
    manifest.entries[bookId] = { bookId, chapterIndex, chapterProgress, progress, updatedAt: Date.now() }
    manifest.lastSyncAt = Date.now()
    await saveManifest(manifest)
  } catch (e) { console.warn('[sync] pushReadingProgress failed', e) }
}

export async function pullReadingProgress(): Promise<Record<string, SyncEntry>> {
  if (!_webdavUrl) return {}
  try {
    const manifest = await loadManifest()
    if (!manifest) return {}
    return manifest.entries
  } catch (e) { console.warn('[sync] pullReadingProgress failed', e)
    return {}
  }
}

export async function syncAll(entries: SyncEntry[]): Promise<Record<string, SyncEntry>> {
  if (!_webdavUrl) return {}
  const manifest = await loadManifest() || { version: 1, deviceId: getDeviceId(), entries: {}, lastSyncAt: 0 }
  let changed = false
  for (const e of entries) {
    const existing = manifest.entries[e.bookId]
    if (!existing || existing.updatedAt < e.updatedAt) {
      manifest.entries[e.bookId] = e
      changed = true
    }
  }
  if (changed) {
    manifest.lastSyncAt = Date.now()
    await saveManifest(manifest)
  }
  return manifest.entries
}
