/**
 * On-demand PDF page renderer — runs on the main thread where DOM canvas is available.
 *
 * Uses pdfjs-dist to render individual pages to canvas data URLs.
 * Caches the loaded PDF document to avoid re-reading the file for every page.
 */

import { logger } from './log'

interface CachedDoc {
  pdf: any // pdfjs-dist PDFDocumentProxy
  numPages: number
  filePath: string
}

let cachedDoc: CachedDoc | null = null

/** Pixel scale factor for canvas rendering (DPI multiplier) */
const RENDER_SCALE = typeof window !== 'undefined' && window.devicePixelRatio
  ? Math.min(window.devicePixelRatio, 2)
  : 1.5

/**
 * Load a PDF file and return the pdfjs-dist document proxy.
 * Results are cached per filePath to avoid repeated I/O.
 */
async function loadPdf(filePath: string): Promise<any> {
  if (cachedDoc && cachedDoc.filePath === filePath) {
    return cachedDoc.pdf
  }

  // Release previous cached doc if switching files
  if (cachedDoc && cachedDoc.filePath !== filePath) {
    try { cachedDoc.pdf.destroy() } catch {}
    cachedDoc = null
  }

  if (!window.electronAPI) {
    throw new Error('PDF 渲染仅在 Electron 环境下可用')
  }

  const result = await window.electronAPI.readFile(filePath)
  if (!result.success || !result.data) {
    throw new Error(result.error || '无法读取 PDF 文件')
  }

  const pdfjsLib = await import('pdfjs-dist')
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    try {
      // Use Vite's ?url import to get the worker script URL
      const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
    } catch {
      // Fallback: allow pdfjs to find its worker via default path
      pdfjsLib.GlobalWorkerOptions.workerSrc = undefined as any
    }
  }

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(result.data) }).promise

  cachedDoc = { pdf, numPages: pdf.numPages, filePath }
  return pdf
}

/**
 * Render a single page of a PDF to a data:image/png;base64 URL.
 *
 * @param filePath  Absolute path to the PDF file on disk
 * @param pageNum   1-based page number
 * @param scale     Optional pixel scale override (defaults to devicePixelRatio capped at 2)
 * @returns         PNG data URI string, or null if rendering failed
 */
export async function renderPage(
  filePath: string,
  pageNum: number,
  scale?: number
): Promise<string | null> {
  try {
    const pdf = await loadPdf(filePath)
    if (pageNum < 1 || pageNum > pdf.numPages) {
      logger.warn(`PDF 页码超出范围: ${pageNum} / ${pdf.numPages}`)
      return null
    }

    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: scale ?? RENDER_SCALE })

    // Create offscreen canvas
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      logger.error('无法获取 Canvas 2D 上下文')
      return null
    }

    await page.render({ canvasContext: ctx, viewport }).promise

    return canvas.toDataURL('image/png')
  } catch (e: any) {
    logger.error(`PDF 页面渲染失败 (page ${pageNum}): ${filePath}`, e)
    return null
  }
}

/**
 * Release cached PDF document to free memory.
 * Call when navigating away from a PDF book.
 */
export function releasePdfCache(): void {
  if (cachedDoc) {
    try { cachedDoc.pdf.destroy() } catch { /* 销毁 PDF 缓存失败，忽略 */ }
    cachedDoc = null
  }
}
