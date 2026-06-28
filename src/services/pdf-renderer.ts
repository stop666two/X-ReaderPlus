/**
 * On-demand PDF page renderer — runs on the main thread where DOM canvas is available.
 *
 * Uses pdfjs-dist to render individual pages to canvas data URLs.
 * Caches the loaded PDF document to avoid re-reading the file for every page.
 * Prefers GET /api/raw/{bookId} for reliable disk access, falls back to filePath cache.
 */

import { logger } from './log'

interface CachedDoc {
  pdf: any
  numPages: number
  bookId: string
}

let cachedDoc: CachedDoc | null = null

const RENDER_SCALE = typeof window !== 'undefined' && window.devicePixelRatio
  ? Math.min(window.devicePixelRatio, 2)
  : 1.5

async function loadPdf(bookId: string, filePath?: string): Promise<any> {
  if (cachedDoc && cachedDoc.bookId === bookId) {
    return cachedDoc.pdf
  }

  if (cachedDoc && cachedDoc.bookId !== bookId) {
    try { cachedDoc.pdf.destroy() } catch {}
    cachedDoc = null
  }

  if (!window.electronAPI) {
    throw new Error('PDF Reader requires the application runtime')
  }

  let data: ArrayBuffer

  const rawResult = await window.electronAPI.rawFile.get(bookId)
  if (rawResult && rawResult instanceof ArrayBuffer) {
    data = rawResult
  } else {
    const result = await window.electronAPI.readFile(filePath || '')
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Cannot read PDF file')
    }
    data = result.data
  }

  const pdfjsLib = await import('pdfjs-dist')
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href
    } catch {
      pdfjsLib.GlobalWorkerOptions.workerSrc = undefined as any
    }
  }

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise
  cachedDoc = { pdf, numPages: pdf.numPages, bookId }
  return pdf
}

export async function renderPage(
  bookId: string,
  filePath: string,
  pageNum: number,
  scale?: number
): Promise<string | null> {
  try {
    const pdf = await loadPdf(bookId, filePath)
    if (pageNum < 1 || pageNum > pdf.numPages) {
      logger.warn(`PDF page out of range: ${pageNum} / ${pdf.numPages}`)
      return null
    }

    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: scale ?? RENDER_SCALE })

    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      logger.error('Cannot get Canvas 2D context')
      return null
    }

    await page.render({ canvasContext: ctx, viewport }).promise
    return canvas.toDataURL('image/png')
  } catch (e: any) {
    logger.error(`PDF page render failed (page ${pageNum})`, e)
    return null
  }
}

export function releasePdfCache(): void {
  if (cachedDoc) {
    try { cachedDoc.pdf.destroy() } catch {}
    cachedDoc = null
  }
}
