/**
 * Cover image compression service.
 * Uses canvas to scale down and recompress cover images, reducing memory usage
 * from 2MB+ per cover (stored as base64 data URIs) to ~10-30KB thumbnails.
 */

const THUMBNAIL_MAX_WIDTH = 200
const THUMBNAIL_MAX_HEIGHT = 300
const THUMBNAIL_QUALITY = 0.6
const MIN_SIZE_TO_COMPRESS = 10 * 1024 // 10 KB — skip already-small images

/**
 * Compress a cover image data URL into a small JPEG thumbnail.
 *
 * Rules:
 * - SVG images are returned as-is (they are naturally tiny vectors).
 * - Non-image data URIs (< 10KB) are returned as-is.
 * - All other images are scaled down to fit within 200×300px and re-encoded as JPEG at quality 0.6.
 *
 * @param dataUrl  The source cover as a data URL (e.g. `data:image/png;base64,...`)
 * @param maxWidth  Maximum width of the output thumbnail (default 200)
 * @param maxHeight Maximum height of the output thumbnail (default 300)
 * @returns A compressed data URL, or the original if compression is not needed.
 */
export function compressCover(
  dataUrl: string,
  maxWidth: number = THUMBNAIL_MAX_WIDTH,
  maxHeight: number = THUMBNAIL_MAX_HEIGHT,
): Promise<string> {
  if (!dataUrl) return Promise.resolve('')

  // SVGs are already small — return as-is
  if (dataUrl.startsWith('data:image/svg+xml')) {
    return Promise.resolve(dataUrl)
  }

  // If already very small, skip compression
  if (dataUrl.length < MIN_SIZE_TO_COMPRESS) {
    return Promise.resolve(dataUrl)
  }

  // Not a recognized image data URL — don't touch it
  if (!dataUrl.startsWith('data:image/')) {
    return Promise.resolve(dataUrl)
  }

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const srcW = img.naturalWidth
        const srcH = img.naturalHeight

        if (srcW <= 0 || srcH <= 0) {
          resolve(dataUrl) // unreadable dimensions
          return
        }

        // Compute target dimensions, maintaining aspect ratio
        let w = srcW
        let h = srcH
        if (w > maxWidth || h > maxHeight) {
          const ratio = Math.min(maxWidth / w, maxHeight / h)
          w = Math.round(w * ratio)
          h = Math.round(h * ratio)
        }

        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(dataUrl)
          return
        }
        ctx.drawImage(img, 0, 0, w, h)

        const compressed = canvas.toDataURL('image/jpeg', THUMBNAIL_QUALITY)

        // Only accept the compressed version if it's actually smaller
        if (compressed.length >= dataUrl.length) {
          resolve(dataUrl)
        } else {
          resolve(compressed)
        }
      } catch {
        resolve(dataUrl) // any canvas error → keep original
      }
    }
    img.onerror = () => {
      resolve(dataUrl) // failed to load → keep original
    }
    img.src = dataUrl
  })
}
