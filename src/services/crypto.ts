import { arrayBufferToBase64, base64ToArrayBuffer } from './base64'

export function generateSalt(length: number = 32): Uint8Array {
  const salt = new Uint8Array(length)
  crypto.getRandomValues(salt)
  return salt
}

export async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 600000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptData(key: CryptoKey, plaintext: string): Promise<{ iv: string; ciphertext: string }> {
  const encoder = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = encoder.encode(plaintext)

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  )

  return {
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertext)
  }
}

export async function decryptData(key: CryptoKey, iv: string, ciphertext: string): Promise<string> {
  const decoder = new TextDecoder()
  const ivBuffer = base64ToArrayBuffer(iv)
  const ciphertextBuffer = base64ToArrayBuffer(ciphertext)

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBuffer },
      key,
      ciphertextBuffer
    )
    return decoder.decode(plaintext)
  } catch {
    throw new Error('解密失败：密钥不正确或数据已损坏')
  }
}

export async function hashPin(pin: string, salt: Uint8Array): Promise<string> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  )

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 600000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  )

  return arrayBufferToBase64(bits)
}

export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key)
  return arrayBufferToBase64(exported)
}

export async function importKey(rawKey: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(rawKey)
  return crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export { arrayBufferToBase64, base64ToArrayBuffer }
