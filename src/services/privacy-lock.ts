/**
 * 隐私锁系统 — 为书库/书籍提供独立密码保护
 *
 * - 使用 PBKDF2 (600000次迭代) + AES-256-GCM 加密内容
 * - 密码要求：8位以上，含大写字母+小写字母+数字
 * - lock hash 存储在 config key: `privacy:${libraryId}` 或 `privacy:book:${bookId}`
 * - 加密后的章节数据存储在 chapters 表的加密字段中
 */
import { generateSalt, hashPin, deriveKey, encryptData, decryptData } from './crypto'

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

export interface LockEntry {
  hash: string
  salt: string
  lockedAt: number
}

// ── password validation ──

export function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8) {
    return { valid: false, message: '密码至少需要8个字符' }
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: '密码必须包含小写字母' }
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: '密码必须包含大写字母' }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '密码必须包含数字' }
  }
  return { valid: true, message: '' }
}

// ── lock helpers ──

function lockKey(libraryId: string): string {
  return `privacy:${libraryId}`
}

function bookLockKey(bookId: string): string {
  return `privacy:book:${bookId}`
}

function encryptedChaptersKey(bookId: string): string {
  return `privacy:enc_ch:${bookId}`
}

async function getLockEntry(key: string): Promise<LockEntry | null> {
  const raw = await configGet(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as LockEntry
  } catch {
    return null
  }
}

async function saveLockEntry(key: string, entry: LockEntry): Promise<void> {
  await configSet(key, JSON.stringify(entry))
}

// ── Library lock ──

/**
 * 为书库设置密码锁定。
 * 生成 lock entry (hash + salt + encryptionKey)，存储在 config。
 */
export async function setLibraryLock(libraryId: string, password: string): Promise<void> {
  const validation = validatePassword(password)
  if (!validation.valid) {
    throw new Error(validation.message)
  }

  const salt = generateSalt()
  const hash = await hashPin(password, salt)
  // Key is NOT stored — derived from password + salt on unlock

  const entry: LockEntry = {
    hash,
    salt: btoa(String.fromCharCode(...salt)),
    lockedAt: Date.now()
  }

  await saveLockEntry(lockKey(libraryId), entry)
}

/**
 * 验证书库密码。
 */
export async function verifyLibraryLock(libraryId: string, password: string): Promise<boolean> {
  const entry = await getLockEntry(lockKey(libraryId))
  if (!entry) return true // no lock set

  const salt = new Uint8Array(
    atob(entry.salt).split('').map(c => c.charCodeAt(0))
  )
  const hash = await hashPin(password, salt)

  // Constant-time comparison
  if (hash.length !== entry.hash.length) return false
  let result = 0
  for (let i = 0; i < hash.length; i++) {
    result |= hash.charCodeAt(i) ^ entry.hash.charCodeAt(i)
  }
  return result === 0
}

/**
 * 移除书库密码。
 */
export async function removeLibraryLock(libraryId: string, password: string): Promise<void> {
  const valid = await verifyLibraryLock(libraryId, password)
  if (!valid) {
    throw new Error('密码错误，无法移除锁定')
  }
  await configDelete(lockKey(libraryId))
}

/**
 * 检查书库是否已锁定。
 */
export async function isLibraryLocked(libraryId: string): Promise<boolean> {
  const entry = await getLockEntry(lockKey(libraryId))
  return entry !== null
}

/**
 * 获取书库的加密密钥（用于加密/解密该书库下的书籍章节）。
 * 返回 null 表示书库未锁定。
 */
export async function getLibraryEncryptionKey(libraryId: string, password: string): Promise<CryptoKey | null> {
  const valid = await verifyLibraryLock(libraryId, password)
  if (!valid) return null

  const entry = await getLockEntry(lockKey(libraryId))
  if (!entry) return null

  // Derive key from password + salt — key is never stored
  try {
    const salt = new Uint8Array(
      atob(entry.salt).split('').map(c => c.charCodeAt(0))
    )
    return deriveKey(password, salt)
  } catch {
    return null
  }
}

// ── Book lock ──

/**
 * 为单本书设置密码锁定，加密其章节内容。
 */
export async function setBookLock(bookId: string, password: string): Promise<void> {
  const validation = validatePassword(password)
  if (!validation.valid) {
    throw new Error(validation.message)
  }

  const salt = generateSalt()
  const hash = await hashPin(password, salt)
  const key = await deriveKey(password, salt)
  // Key is NOT stored — derived from password + salt on unlock

  const entry: LockEntry = {
    hash,
    salt: btoa(String.fromCharCode(...salt)),
    lockedAt: Date.now()
  }

  await saveLockEntry(bookLockKey(bookId), entry)

  // Encrypt existing chapter content if present
  const raw = await getChaptersRaw(bookId)
  if (raw) {
    const { iv, ciphertext } = await encryptData(key, raw)
    const encData = JSON.stringify({ iv, ciphertext })
    await configSet(encryptedChaptersKey(bookId), encData)

    // H-10: Verify encrypted data is decryptable before wiping plaintext
    try {
      const decrypted = await decryptData(key, iv, ciphertext)
      if (decrypted === raw) {
        await deleteChaptersRaw(bookId)
      } else {
        throw new Error('Decryption verification mismatch')
      }
    } catch {
      // Rollback: remove failed encryption, keep plaintext intact
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
  if (!entry) return true // no lock set

  const salt = new Uint8Array(
    atob(entry.salt).split('').map(c => c.charCodeAt(0))
  )
  const hash = await hashPin(password, salt)

  if (hash.length !== entry.hash.length) return false
  let result = 0
  for (let i = 0; i < hash.length; i++) {
    result |= hash.charCodeAt(i) ^ entry.hash.charCodeAt(i)
  }
  return result === 0
}

/**
 * 移除单本书密码，解密密文并恢复到 chapters 表。
 */
export async function removeBookLock(bookId: string, password: string): Promise<void> {
  const valid = await verifyBookLock(bookId, password)
  if (!valid) {
    throw new Error('密码错误，无法移除锁定')
  }

  // Restore chapters from encrypted storage
  const encRaw = await configGet(encryptedChaptersKey(bookId))
  if (encRaw) {
    try {
      const entry = await getLockEntry(bookLockKey(bookId))
      if (entry) {
        const salt = new Uint8Array(
          atob(entry.salt).split('').map(c => c.charCodeAt(0))
        )
        const key = await deriveKey(password, salt)
        const { iv, ciphertext } = JSON.parse(encRaw)
        const plaintext = await decryptData(key, iv, ciphertext)
        await saveChaptersRaw(bookId, plaintext)
      }
    } catch (e) {
      // Decryption failed — keep encrypted data and throw to prevent data loss
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(`解锁书籍失败（解密错误）：${msg}。数据未丢失，请重试或检查密码。`)
    }
    await configDelete(encryptedChaptersKey(bookId))
  }

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
  const valid = await verifyBookLock(bookId, password)
  if (!valid) return null

  const entry = await getLockEntry(bookLockKey(bookId))
  if (!entry) return null

  // Derive key from password + salt — key is never stored
  try {
    const salt = new Uint8Array(
      atob(entry.salt).split('').map(c => c.charCodeAt(0))
    )
    return deriveKey(password, salt)
  } catch {
    return null
  }
}

// ── Chapter content helpers ──

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

/**
 * 解密被锁定的章节内容。
 * 先尝试从加密存储中获取；如果存在则用密钥解密后返回。
 * 返回 null 表示未找到或解密失败。
 */
export async function decryptBookChapters(bookId: string, key: CryptoKey): Promise<string | null> {
  const encRaw = await configGet(encryptedChaptersKey(bookId))
  if (!encRaw) {
    // Fallback: chapters were never encrypted, try raw storage
    return getChaptersRaw(bookId)
  }

  try {
    const { iv, ciphertext } = JSON.parse(encRaw)
    return decryptData(key, iv, ciphertext)
  } catch {
    return null
  }
}

/**
 * 加密并存储章节内容。
 */
export async function encryptBookChapters(bookId: string, chaptersJson: string, key: CryptoKey): Promise<void> {
  const { iv, ciphertext } = await encryptData(key, chaptersJson)
  await configSet(encryptedChaptersKey(bookId), JSON.stringify({ iv, ciphertext }))
  await deleteChaptersRaw(bookId)
}
