export async function sha256(data: ArrayBuffer | string): Promise<string> {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data
  const hashBuffer = await crypto.subtle.digest('SHA-256', buf)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Response(blob).arrayBuffer()
}
