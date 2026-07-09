/**
 * 隐私锁系统 — 为书库/书籍提供独立密码保护
 *
 * - 使用 PBKDF2 (600000次迭代) + AES-256-GCM 加密内容
 * - 密码要求：8位以上，含大写字母+小写字母+数字
 * - lock hash 存储在 config key: `privacy:${libraryId}` 或 `privacy:book:${bookId}`
 * - 加密后的章节数据存储在 config: `privacy:enc_ch:${bookId}`
 * - 解密后的密钥缓存于内存中，页面刷新后需重新输入密码
 */
import { generateSalt, hashPin, deriveKey, encryptData, decryptData } from './crypto'
import { BASE } from './api-bridge'

// ── in-memory key cache (survives page navigation, lost on refresh) ──
const _libraryKeyCache = new Map<string, CryptoKey>()
const _bookKeyCache = new Map<string, CryptoKey>()

// ── helpers ──

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

async function getChaptersRaw(bookId: string): Promise<string | null> {
  if (typeof window !== 'undefined' && window.electronAPI?.chapters) {
    return window.electronAPI.chapters.get(bookId)
  }
  return null
}

async function saveChaptersRaw(bookId: string, data: string): Promise<void> {
  if (typeof window !== 'undefined' && window.electronAPI?.chapters) {
    await window.electronAPI.chapters.set(bookId, data)
  }
}

async function deleteChaptersRaw(bookId: string): Promise<void> {
  if (typeof window !== 'undefined' && window.electronAPI?.chapters) {
    await window.electronAPI.chapters.delete(bookId)
  }
}

export interface LockEntry {
  hash: string
  salt: string
  lockedAt: number
}

// ── password validation ──

export function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8) return { valid: false, message: '密码至少需要8个字符' }
  if (!/[a-z]/.test(password)) return { valid: false, message: '密码必须包含小写字母' }
  if (!/[A-Z]/.test(password)) return { valid: false, message: '密码必须包含大写字母' }
  if (!/[0-9]/.test(password)) return { valid: false, message: '密码必须包含数字' }
  return { valid: true, message: '' }
}

// ── lock key helpers ──

function lockKey(libraryId: string): string { return `privacy:${libraryId}` }
function bookLockKey(bookId: string): string { return `privacy:book:${bookId}` }
function encryptedChaptersKey(bookId: string): string { return `privacy:enc_ch:${bookId}` }

async function getLockEntry(key: string): Promise<LockEntry | null> {
  const raw = await configGet(key)
  if (!raw) return null
  try { return JSON.parse(raw) as LockEntry } catch { return null }
}

async function saveLockEntry(key: string, entry: LockEntry): Promise<void> {
  await configSet(key, JSON.stringify(entry))
}

// ── salt encoding helpers ──

function encodeSalt(salt: Uint8Array): string {
  return btoa(String.fromCharCode(...salt))
}

function decodeSalt(encoded: string): Uint8Array {
  return new Uint8Array(atob(encoded).split('').map(c => c.charCodeAt(0)))
}

// ── chapter encryption helpers ──

async function encryptChapterContent(key: CryptoKey, bookId: string): Promise<void> {
  const raw = await getChaptersRaw(bookId)
  if (!raw) return
  const { iv, ciphertext } = await encryptData(key, raw)
  await configSet(encryptedChaptersKey(bookId), JSON.stringify({ iv, ciphertext }))
  // Verify before wiping
  const decrypted = await decryptData(key, iv, ciphertext)
  if (decrypted === raw) {
    await deleteChaptersRaw(bookId)
  } else {
    await configDelete(encryptedChaptersKey(bookId))
    throw new Error('加密验证失败，已回滚')
  }
}

async function decryptChapterContent(key: CryptoKey, bookId: string): Promise<void> {
  const encRaw = await configGet(encryptedChaptersKey(bookId))
  if (!encRaw) return
  const { iv, ciphertext } = JSON.parse(encRaw)
  const plaintext = await decryptData(key, iv, ciphertext)
  await saveChaptersRaw(bookId, plaintext)
  await configDelete(encryptedChaptersKey(bookId))
}

// ── Library lock ──

export async function setLibraryLock(libraryId: string, password: string): Promise<void> {
  const validation = validatePassword(password)
  if (!validation.valid) throw new Error(validation.message)

  const salt = generateSalt()
  const hash = await hashPin(password, salt)
  const key = await deriveKey(password, salt)

  await saveLockEntry(lockKey(libraryId), {
    hash, salt: encodeSalt(salt), lockedAt: Date.now()
  })

  _libraryKeyCache.set(libraryId, key)
}

export async function verifyLibraryLock(libraryId: string, password: string): Promise<boolean> {
  const entry = await getLockEntry(lockKey(libraryId))
  if (!entry) return true

  const salt = decodeSalt(entry.salt)
  const hash = await hashPin(password, salt)

  if (hash.length !== entry.hash.length) return false
  let result = 0
  for (let i = 0; i < hash.length; i++) result |= hash.charCodeAt(i) ^ entry.hash.charCodeAt(i)
  const ok = result === 0
  if (ok) {
    // Cache key in memory for this session
    const key = await deriveKey(password, salt)
    _libraryKeyCache.set(libraryId, key)
  }
  return ok
}

export async function removeLibraryLock(libraryId: string, password: string): Promise<void> {
  const valid = await verifyLibraryLock(libraryId, password)
  if (!valid) throw new Error('密码错误，无法移除锁定')

  const key = _libraryKeyCache.get(libraryId)
  if (!key) throw new Error('密钥不可用，请重新解锁')

  // Decrypt all books in this library
  const allBooks = await getAllBooksInLibrary(libraryId)
  for (const book of allBooks) {
    try { await decryptChapterContent(key, book) } catch { /* skip books without encrypted chapters */ }
  }

  _libraryKeyCache.delete(libraryId)
  await configDelete(lockKey(libraryId))
}

export async function isLibraryLocked(libraryId: string): Promise<boolean> {
  const entry = await getLockEntry(lockKey(libraryId))
  return entry !== null
}

export async function getLibraryEncryptionKey(libraryId: string, password: string): Promise<CryptoKey | null> {
  // Check cache first
  const cached = _libraryKeyCache.get(libraryId)
  if (cached) return cached

  const valid = await verifyLibraryLock(libraryId, password)
  if (!valid) return null
  const entry = await getLockEntry(lockKey(libraryId))
  if (!entry) return null

  try {
    const salt = decodeSalt(entry.salt)
    const key = await deriveKey(password, salt)
    _libraryKeyCache.set(libraryId, key)
    return key
  } catch { return null }
}

export async function getLibraryKeyFromCache(libraryId: string): Promise<CryptoKey | null> {
  return _libraryKeyCache.get(libraryId) || null
}

async function getAllBooksInLibrary(libraryId: string): Promise<string[]> {
  try {
    const resp = await fetch(`${BASE}/api/books?page=1&pageSize=10000&libraryId=${encodeURIComponent(libraryId)}`)
    if (!resp.ok) return []
    const data = await resp.json()
    const books = Array.isArray(data) ? data[0] : []
    return (books || []).map((b: any) => b.id).filter(Boolean)
  } catch { return [] }
}

// ── Book lock ──

/**
 * 为单本书设置密码锁定，加密其章节内容。
 */
export async function setBookLock(bookId: string, password: string): Promise<void> {
  const validation = validatePassword(password)
  if (!validation.valid) throw new Error(validation.message)

  const salt = generateSalt()
  const hash = await hashPin(password, salt)
  const key = await deriveKey(password, salt)

  await saveLockEntry(bookLockKey(bookId), {
    hash, salt: encodeSalt(salt), lockedAt: Date.now()
  })

  _bookKeyCache.set(bookId, key)

  // Encrypt existing chapters
  const raw = await getChaptersRaw(bookId)
  if (raw) {
    const { iv, ciphertext } = await encryptData(key, raw)
    await configSet(encryptedChaptersKey(bookId), JSON.stringify({ iv, ciphertext }))
    // Verify before wiping
    const decrypted = await decryptData(key, iv, ciphertext)
    if (decrypted === raw) {
      await deleteChaptersRaw(bookId)
    } else {
      await configDelete(encryptedChaptersKey(bookId))
      throw new Error('加密验证失败，已回滚')
    }
  }
}

/**
 * 验证单本书密码。
 */
export async function verifyBookLock(bookId: string, password: string): Promise<boolean> {
  const entry = await getLockEntry(bookLockKey(bookId))
  if (!entry) return true

  const salt = decodeSalt(entry.salt)
  const hash = await hashPin(password, salt)

  if (hash.length !== entry.hash.length) return false
  let result = 0
  for (let i = 0; i < hash.length; i++) result |= hash.charCodeAt(i) ^ entry.hash.charCodeAt(i)
  const ok = result === 0
  if (ok) {
    const key = await deriveKey(password, salt)
    _bookKeyCache.set(bookId, key)
  }
  return ok
}

/**
 * 移除单本书密码，解密密文并恢复到 chapters 表。
 * 必须先验证密码，再使用缓存或派生密钥。
 */
export async function removeBookLock(bookId: string, password: string): Promise<void> {
  const valid = await verifyBookLock(bookId, password)
  if (!valid) throw new Error('密码错误，无法移除锁定')

  const key = _bookKeyCache.get(bookId)
  if (!key) throw new Error('密钥不可用，请重新解锁')

  const encRaw = await configGet(encryptedChaptersKey(bookId))
  if (encRaw) {
    try {
      const { iv, ciphertext } = JSON.parse(encRaw)
      const plaintext = await decryptData(key, iv, ciphertext)
      await saveChaptersRaw(bookId, plaintext)
      await configDelete(encryptedChaptersKey(bookId))
    } catch (e) {
      throw new Error(`解锁失败：${e instanceof Error ? e.message : String(e)}。数据未丢失，请重试。`)
    }
  }

  _bookKeyCache.delete(bookId)
  await configDelete(bookLockKey(bookId))
}

/**
 * 检查单本书是否已锁定。
 */
export async function isBookLocked(bookId: string): Promise<boolean> {
  const entry = await getLockEntry(bookLockKey(bookId))
  return entry !== null
}

/**
 * 获取书籍的加密密钥。
 */
export async function getBookEncryptionKey(bookId: string, password: string): Promise<CryptoKey | null> {
  const cached = _bookKeyCache.get(bookId)
  if (cached) return cached

  const valid = await verifyBookLock(bookId, password)
  if (!valid) return null

  const entry = await getLockEntry(bookLockKey(bookId))
  if (!entry) return null

  try {
    const salt = decodeSalt(entry.salt)
    const key = await deriveKey(password, salt)
    _bookKeyCache.set(bookId, key)
    return key
  } catch { return null }
}

/**
 * 解密被锁定的章节内容。
 * 先尝试从加密存储中获取；如果存在则用密钥解密后返回。
 * 返回 null 表示未找到或解密失败。
 */
export async function decryptBookChapters(bookId: string, key: CryptoKey): Promise<string | null> {
  const encRaw = await configGet(encryptedChaptersKey(bookId))
  if (!encRaw) return getChaptersRaw(bookId)
  try {
    const { iv, ciphertext } = JSON.parse(encRaw)
    return decryptData(key, iv, ciphertext)
  } catch { return null }
}

/**
 * 加密并存储章节内容。
 */
export async function encryptBookChapters(bookId: string, chaptersJson: string, key: CryptoKey): Promise<void> {
  const { iv, ciphertext } = await encryptData(key, chaptersJson)
  await configSet(encryptedChaptersKey(bookId), JSON.stringify({ iv, ciphertext }))
  await deleteChaptersRaw(bookId)
}
