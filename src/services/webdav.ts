import { arrayBufferToBase64, base64ToArrayBuffer } from './base64'

const ENC_KEY_CFG = 'webdavEncKey'

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

async function getOrCreateEncKey(): Promise<CryptoKey> {
  const v = await configGet(ENC_KEY_CFG)
  if (v) {
    const rawKey = base64ToArrayBuffer(v)
    return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const exported = await crypto.subtle.exportKey('raw', key)
  await configSet(ENC_KEY_CFG, arrayBufferToBase64(exported))
  return key
}

export async function encryptPassword(plaintext: string): Promise<{ iv: string; ciphertext: string }> {
  const key = await getOrCreateEncKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  return {
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertext)
  }
}

export async function decryptPassword(iv: string, ciphertext: string): Promise<string> {
  const key = await getOrCreateEncKey()
  const ivBuffer = base64ToArrayBuffer(iv)
  const ctBuffer = base64ToArrayBuffer(ciphertext)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBuffer }, key, ctBuffer)
  return new TextDecoder().decode(plaintext)
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
  const fileUrl = buildUrl(url, fileName)
  const resp = await fetch(fileUrl, {
    method: 'PUT',
    headers: {
      Authorization: basicAuthHeader(username, password),
      'Content-Type': 'application/octet-stream'
    },
    body: data
  })
  if (!resp.ok) throw new Error(`上传失败 (${resp.status}): ${resp.statusText}`)
}

export async function downloadFile(url: string, username: string, password: string, fileName: string): Promise<ArrayBuffer> {
  const fileUrl = buildUrl(url, fileName)
  const resp = await fetch(fileUrl, {
    method: 'GET',
    headers: {
      Authorization: basicAuthHeader(username, password)
    }
  })
  if (!resp.ok) throw new Error(`下载失败 (${resp.status}): ${resp.statusText}`)
  return resp.arrayBuffer()
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
