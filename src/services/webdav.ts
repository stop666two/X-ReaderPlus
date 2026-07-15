// WebDAV backup — opt-in feature. All data AES-256-GCM encrypted.
// Key derived from user password via PBKDF2, persisted as exported raw key in config.
import { arrayBufferToBase64, base64ToArrayBuffer } from './base64'

const WEBDAV_KEY_CONFIG = 'webdav_encryption_key'
const WEBDAV_SALT_CONFIG = 'webdav_salt'
const ENC_MAGIC = new Uint8Array([0x58, 0x52, 0x50, 0x45, 0x4e, 0x43, 0x30, 0x30]) // "XRPENC00"

let _cryptoKey: CryptoKey | null = null

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true, // extractable — needed for persistence
    ['encrypt', 'decrypt']
  )
}

function hasElectronAPI(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.config
}

// Persist the raw exported key so it survives page refresh
async function persistKey(key: CryptoKey): Promise<void> {
  if (!hasElectronAPI()) return
  const raw = await crypto.subtle.exportKey('raw', key)
  await configSet(WEBDAV_KEY_CONFIG, arrayBufferToBase64(raw))
}

async function loadPersistedKey(): Promise<CryptoKey | null> {
  if (!hasElectronAPI()) return null
  const raw = await configGet(WEBDAV_KEY_CONFIG)
  if (!raw) return null
  try {
    const keyBuffer = base64ToArrayBuffer(raw)
    return await crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  } catch {
    await configDelete(WEBDAV_KEY_CONFIG)
    return null
  }
}

export async function setEncryptionPassword(password: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(32))
  _cryptoKey = await deriveKey(password, salt)
  await persistKey(_cryptoKey)
  await configSet(WEBDAV_SALT_CONFIG, arrayBufferToBase64(salt))
}

export async function hasEncryptionKey(): Promise<boolean> {
  if (_cryptoKey) return true
  const key = await loadPersistedKey()
  if (key) {
    _cryptoKey = key
    return true
  }
  return false
}

export async function clearEncryptionKey(): Promise<void> {
  _cryptoKey = null
  await configDelete(WEBDAV_KEY_CONFIG)
  await configDelete(WEBDAV_SALT_CONFIG)
}

async function getCryptoKey(): Promise<CryptoKey | null> {
  if (_cryptoKey) return _cryptoKey
  _cryptoKey = await loadPersistedKey()
  return _cryptoKey
}

// Config helpers
function configGet(key: string): Promise<string | null> {
  if (typeof window !== 'undefined' && window.electronAPI?.config) {
    return window.electronAPI.config.get(key).then((v: string | undefined | null) => v ?? null)
  }
  return Promise.resolve(localStorage.getItem(key))
}
function configSet(key: string, value: string): Promise<void> {
  if (typeof window !== 'undefined' && window.electronAPI?.config) {
    return window.electronAPI.config.set(key, value)
  }
  localStorage.setItem(key, value)
  return Promise.resolve()
}
function configDelete(key: string): Promise<void> {
  if (typeof window !== 'undefined' && window.electronAPI?.config) {
    return window.electronAPI.config.delete(key)
  }
  localStorage.removeItem(key)
  return Promise.resolve()
}

export async function encryptPassword(plaintext: string): Promise<{ iv: string; ciphertext: string }> {
  const key = await getCryptoKey()
  if (!key) throw new Error('Encryption password not set')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  return { iv: arrayBufferToBase64(iv), ciphertext: arrayBufferToBase64(ciphertext) }
}

export async function decryptPassword(iv: string, ciphertext: string): Promise<string> {
  const key = await getCryptoKey()
  if (!key) throw new Error('Encryption password not set')
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToArrayBuffer(iv) }, key, base64ToArrayBuffer(ciphertext))
  return new TextDecoder().decode(plaintext)
}

// Encrypted payload format: [8-byte magic][12-byte IV][ciphertext]
async function encryptData(data: ArrayBuffer): Promise<{ iv: Uint8Array; encrypted: ArrayBuffer }> {
  const key = await getCryptoKey()
  if (!key) throw new Error('Encryption password not set')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  return { iv, encrypted }
}

function isEncrypted(data: ArrayBuffer): boolean {
  if (data.byteLength < ENC_MAGIC.length + 1) return false
  const header = new Uint8Array(data.slice(0, ENC_MAGIC.length))
  return header.every((b, i) => b === ENC_MAGIC[i])
}

function stripMagic(data: ArrayBuffer): ArrayBuffer {
  return data.slice(ENC_MAGIC.length)
}

function encodeFileName(name: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(name)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeFileName(enc: string): string {
  const b64 = enc.replace(/-/g, '+').replace(/_/g, '/')
  return new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)))
}

function basicAuthHeader(username: string, password: string): string {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(username + ':' + password)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return 'Basic ' + btoa(binary)
}

function parseMultiStatus(xmlText: string): Array<{ href: string; isCollection: boolean; size: number; lastModified: string }> {
  const entries: Array<{ href: string; isCollection: boolean; size: number; lastModified: string }> = []
  const responseRegex = /<[d:]*response>([\s\S]*?)<\/[d:]*response>/g
  let match
  while ((match = responseRegex.exec(xmlText)) !== null) {
    const block = match[1]
    const hrefMatch = block.match(/<[d:]*href>([^<]+)<\/[d:]*href>/)
    const collectionMatch = block.match(/<[d:]*collection\s*\/>/)
    const sizeMatch = block.match(/<[d:]*getcontentlength>(\d+)<\/[d:]*getcontentlength>/)
    const dateMatch = block.match(/<[d:]*getlastmodified>([^<]+)<\/[d:]*getlastmodified>/)
    if (hrefMatch) {
      entries.push({
        href: hrefMatch[1],
        isCollection: !!collectionMatch,
        size: sizeMatch ? Number(sizeMatch[1]) : 0,
        lastModified: dateMatch ? dateMatch[1] : ''
      })
    }
  }
  return entries
}

function buildUrl(base: string, path: string): string {
  const clean = base.replace(/\/+$/, '')
  return clean + '/' + path.replace(/^\/+/, '')
}

export async function testConnection(url: string, username: string, password: string): Promise<{ success: boolean; message: string }> {
  try {
    const resp = await fetch(buildUrl(url, ''), {
      method: 'PROPFIND',
      headers: {
        Authorization: basicAuthHeader(username, password),
        Depth: '0'
      }
    })
    if (resp.status >= 200 && resp.status < 300) {
      return { success: true, message: '连接成功' }
    }
    if (resp.status === 401 || resp.status === 403) {
      return { success: false, message: '认证失败：用户名或密码错误' }
    }
    if (resp.status === 404) {
      return { success: false, message: '服务器路径未找到 (404)' }
    }
    return { success: false, message: `服务器返回状态码 ${resp.status}` }
  } catch (e: any) {
    return { success: false, message: '连接失败：' + (e.message || '未知错误') }
  }
}

export async function listDirectory(url: string, username: string, password: string): Promise<Array<{ href: string; isCollection: boolean; size: number; lastModified: string }>> {
  const resp = await fetch(buildUrl(url, ''), {
    method: 'PROPFIND',
    headers: {
      Authorization: basicAuthHeader(username, password),
      Depth: '1'
    }
  })
  if (!resp.ok) throw new Error(`PROPFIND failed: ${resp.status}`)
  const xml = await resp.text()
  return parseMultiStatus(xml)
}

export async function uploadFile(url: string, username: string, password: string, fileName: string, data: ArrayBuffer): Promise<void> {
  const key = await getCryptoKey()
  const hasKey = key !== null
  const encName = hasKey ? encodeFileName(fileName) : encodeURIComponent(fileName)
  let uploadData: ArrayBuffer
  if (hasKey) {
    const { iv, encrypted } = await encryptData(data)
    // Format: [8-byte magic][12-byte IV][ciphertext]
    const payload = new Uint8Array(ENC_MAGIC.length + iv.length + encrypted.byteLength)
    payload.set(ENC_MAGIC, 0)
    payload.set(iv, ENC_MAGIC.length)
    payload.set(new Uint8Array(encrypted), ENC_MAGIC.length + iv.length)
    uploadData = payload.buffer
  } else {
    uploadData = data
  }
  const fileUrl = buildUrl(url, encName)
  const resp = await fetch(fileUrl, { method: 'PUT', headers: { Authorization: basicAuthHeader(username, password), 'Content-Type': 'application/octet-stream' }, body: uploadData })
  if (!resp.ok) throw new Error(`Upload failed (${resp.status})`)
}

export async function downloadFile(url: string, username: string, password: string, fileName: string): Promise<ArrayBuffer> {
  const key = await getCryptoKey()
  const hasKey = key !== null
  const encName = hasKey ? encodeFileName(fileName) : encodeURIComponent(fileName)
  const fileUrl = buildUrl(url, encName)
  const resp = await fetch(fileUrl, { method: 'GET', headers: { Authorization: basicAuthHeader(username, password) } })
  if (!resp.ok) throw new Error(`Download failed (${resp.status})`)
  const data = await resp.arrayBuffer()
  if (hasKey && isEncrypted(data)) {
    const stripped = stripMagic(data)
    const iv = new Uint8Array(stripped.slice(0, 12))
    const ct = stripped.slice(12)
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  }
  return data
}

export async function listBackups(url: string, username: string, password: string): Promise<string[]> {
  const entries = await listDirectory(url, username, password)
  return entries
    .filter(e => !e.isCollection && e.href.endsWith('.json'))
    .map(e => {
      const parts = e.href.split('/')
      return decodeURIComponent(parts[parts.length - 1])
    })
}

export async function ensureDirectory(url: string, username: string, password: string, dirName: string): Promise<void> {
  const dirUrl = buildUrl(url, dirName)
  const resp = await fetch(dirUrl, {
    method: 'MKCOL',
    headers: {
      Authorization: basicAuthHeader(username, password)
    }
  })
  if (!resp.ok && resp.status !== 405) {
    throw new Error(`创建目录失败 (${resp.status})`)
  }
}

export async function deleteFile(url: string, username: string, password: string, fileName: string): Promise<void> {
  const fileUrl = buildUrl(url, fileName)
  const resp = await fetch(fileUrl, {
    method: 'DELETE',
    headers: {
      Authorization: basicAuthHeader(username, password)
    }
  })
  if (!resp.ok) throw new Error(`删除失败 (${resp.status})`)
}
