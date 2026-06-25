/**
 * Convert ArrayBuffer to Base64 string.
 * Uses chunked processing for efficiency with large buffers.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000 // 32KB chunks — avoids "Maximum call stack" errors
  const chunks: string[] = []
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    chunks.push(String.fromCharCode(...chunk))
  }
  return btoa(chunks.join(''))
}

/**
 * Convert Base64 string back to ArrayBuffer.
 * Uses chunked decoding for efficiency with large strings.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const chunkSize = 0x8000
  const length = binary.length
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i += chunkSize) {
    const end = Math.min(i + chunkSize, length)
    for (let j = i; j < end; j++) {
      bytes[j] = binary.charCodeAt(j)
    }
  }
  return bytes.buffer
}

/** Generate a unique ID using timestamp + crypto random (L-8: shared utility) */
export function generateId(): string {
  const ts = Date.now().toString(36)
  const r = crypto.getRandomValues(new Uint8Array(8))
  return `${ts}-${Array.from(r).map(b => b.toString(16).padStart(2, '0')).join('')}`
}
