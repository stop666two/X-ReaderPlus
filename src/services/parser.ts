import type { BookFormat, ParsedBook, ChapterContent, TocItem } from '@/types'
import { sanitizeEpubContent } from './sanitize'
import { logger } from './log'
import { MAX_FILE_SIZE, MAX_EPUB_FILES, AUTHOR_PATTERNS, CHAPTER_PATTERNS } from '@/constants'

// ========== Encoding detection ==========

/** Priority-ordered encodings to try for text files without BOM */
const TXT_ENCODINGS = [
  'utf-8', 'gb18030', 'gbk', 'gb2312', 'big5',
  'shift_jis', 'euc-jp', 'euc-kr', 'utf-16le', 'utf-16be'
]

/** BOM (Byte Order Mark) detection */
function detectBOM(data: Uint8Array): { encoding: string; offset: number } {
  if (data.length >= 3 && data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
    return { encoding: 'utf-8', offset: 3 }
  }
  if (data.length >= 2 && data[0] === 0xFF && data[1] === 0xFE) {
    return { encoding: 'utf-16le', offset: 2 }
  }
  if (data.length >= 2 && data[0] === 0xFE && data[1] === 0xFF) {
    return { encoding: 'utf-16be', offset: 2 }
  }
  return { encoding: '', offset: 0 }
}

/** Try multiple encodings and pick the one with fewest replacement characters */
function decodeTextBest(data: Uint8Array, extraEncodings?: string[]): string {
  const bom = detectBOM(data)
  const toTry = bom.encoding
    ? [bom.encoding, ...TXT_ENCODINGS.filter(e => e !== bom.encoding)]
    : [...(extraEncodings || []), ...TXT_ENCODINGS].filter((e, i, a) => a.indexOf(e) === i)

  let text = ''
  let bestScore = Infinity

  for (const enc of toTry) {
    try {
      const decoder = new TextDecoder(enc, { fatal: false })
      const decoded = decoder.decode(bom.encoding ? data.slice(bom.offset) : data)
      const replacementCount = (decoded.match(/\ufffd/g) || []).length
      if (decoded.length > 0 && replacementCount < bestScore) {
        text = decoded
        bestScore = replacementCount
        if (replacementCount === 0) break
      }
    } catch { /* skip unsupported encodings */ }
  }

  return text
}

export async function parseBook(filePath: string, fileName: string, fileData: ArrayBuffer, fileSize: number): Promise<ParsedBook> {
  if (fileSize > MAX_FILE_SIZE) throw new Error(`文件过大（超过 ${MAX_FILE_SIZE / 1024 / 1024}MB）`)
  const format = detectFormat(fileName)
  switch (format) {
    case 'epub': return parseEpub(fileData, fileName)
    case 'txt': return parseTxt(fileData, fileName)
    case 'markdown': return parseMarkdown(fileData, fileName)
    case 'html': return parseHtml(fileData, fileName)
    case 'mobi': case 'azw3': return parseMobi(fileData, fileName, format)
    case 'fb2': return parseFb2(fileData, fileName)
    case 'djvu': return parseDjvu(fileData, fileName)
    case 'docx': case 'rtf': case 'odt': return parseDocx(fileData, fileName, format)
    case 'pdf': return parsePdf(fileData, fileName)
    case 'cbr': case 'cbz': case 'cbt': case 'cb7': return parseComic(fileData, fileName, format)
    default: throw new Error(`不支持的文件格式: ${fileName}`)
  }
}

export function detectFormat(fileName: string): BookFormat {
  const ext = fileName.toLowerCase().split('.').pop() || ''
  const map: Record<string, BookFormat> = {
    'epub': 'epub', 'txt': 'txt', 'md': 'markdown', 'markdown': 'markdown',
    'html': 'html', 'htm': 'html', 'mobi': 'mobi', 'azw': 'azw3', 'azw3': 'azw3',
    'fb2': 'fb2', 'djvu': 'djvu', 'docx': 'docx', 'rtf': 'rtf', 'odt': 'odt',
    'pdf': 'pdf', 'cbr': 'cbr', 'cbz': 'cbz', 'cbt': 'cbt', 'cb7': 'cb7'
  }
  const format = map[ext]
  if (!format) throw new Error(`未知文件格式: ${ext}`)
  return format
}

// ========== Smart author detection ==========

function detectAuthor(text: string, fallbackTitle: string, fallbackFormat: string): string {
  const lines = text.split(/\r?\n/)

  // Check first 40 lines
  const firstBlock = lines.slice(0, 40).join('\n')
  for (const pattern of AUTHOR_PATTERNS) {
    const m = firstBlock.match(pattern)
    if (m && m[1] && m[1].trim().length > 0 && m[1].trim().length < 80) {
      return m[1].trim().replace(/[<>]/g, '')
    }
  }

  // Check last 15 lines
  const lastBlock = lines.slice(-15).join('\n')
  for (const pattern of AUTHOR_PATTERNS) {
    const m = lastBlock.match(pattern)
    if (m && m[1] && m[1].trim().length > 0 && m[1].trim().length < 80) {
      return m[1].trim().replace(/[<>]/g, '')
    }
  }

  return '未知作者'
}

// ========== Smart chapter detection ==========

function splitChapters(text: string, fallbackTitle: string): ChapterContent[] {
  const paragraphs = text.split(/\r?\n/)
  const chapters: ChapterContent[] = []
  let currentTitle = ''
  let currentLines: string[] = []
  let pendingTitle = ''

  for (let i = 0; i < paragraphs.length; i++) {
    const line = paragraphs[i]
    const trimmed = line.trim()
    if (!trimmed) { currentLines.push(line); continue }

    let matched = false
    for (const pattern of CHAPTER_PATTERNS) {
      const m = trimmed.match(pattern)
      if (m) {
        // Save previous chapter
        if (currentLines.length > 0 || currentTitle) {
          chapters.push({
            title: currentTitle || fallbackTitle,
            content: currentLines.map(l => `<p>${escapeHtml(l)}</p>`).join('\n')
          })
        }
        currentTitle = trimmed.length > 80 ? trimmed.slice(0, 77) + '...' : trimmed
        currentLines = []
        matched = true
        break
      }
    }

    if (!matched) {
      currentLines.push(line)
    }
  }

  // Last chapter
  if (currentLines.length > 0 || currentTitle) {
    chapters.push({
      title: currentTitle || fallbackTitle,
      content: currentLines.map(l => `<p>${escapeHtml(l)}</p>`).join('\n')
    })
  }

  // Fallback: if no chapters detected, make one big chapter
  if (chapters.length === 0) {
    chapters.push({
      title: fallbackTitle,
      content: paragraphs.map(l => `<p>${escapeHtml(l)}</p>`).join('\n')
    })
  }

  return chapters
}

// ========== EPUB ==========

async function parseEpub(fileData: ArrayBuffer, fileName: string): Promise<ParsedBook> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(fileData)
  if (Object.keys(zip.files).length > MAX_EPUB_FILES) throw new Error(`EPUB 文件数过多（超过 ${MAX_EPUB_FILES}）`)

  const container = zip.file('META-INF/container.xml')
  if (!container) throw new Error('无效的 EPUB 文件')
  const containerXml = await container.async('string')
  const rootMatch = containerXml.match(/full-path\s*=\s*["']([^"']+)["']/)
  if (!rootMatch) throw new Error('无法找到 rootfile')
  const rootPath = rootMatch[1]
  const rootDir = rootPath.includes('/') ? rootPath.substring(0, rootPath.lastIndexOf('/') + 1) : ''

  const opf = zip.file(rootPath)
  if (!opf) throw new Error('找不到 OPF 文件')
  const opfXml = await opf.async('string')

  const title = extractXmlTag(opfXml, 'dc:title') || extractXmlTag(opfXml, 'title') || fileName.replace(/\.epub$/i, '')
  const author = extractXmlTag(opfXml, 'dc:creator') || '未知作者'

  // Parse manifest & spine
  const manifest: Record<string, { href: string; mediaType: string }> = {}
  for (const m of opfXml.matchAll(/<item[^>]*>/g)) {
    const id = extractAttr(m[0], 'id')
    const href = extractAttr(m[0], 'href')
    if (id && href) manifest[id] = { href, mediaType: extractAttr(m[0], 'media-type') || '' }
  }
  const spine: string[] = []
  // Handle various itemref forms: self-closing, non-self-closing, single/double quotes
  for (const m of opfXml.matchAll(/<itemref[^>]*?idref\s*=\s*["']([^"']+)["'][^>]*\/?>/g)) { spine.push(m[1]) }
  // Also try non-self-closing form: <itemref ...> </itemref>
  for (const m of opfXml.matchAll(/<itemref[^>]*?idref\s*=\s*["']([^"']+)["'][^>]*>/g)) {
    if (!spine.includes(m[1])) spine.push(m[1])
  }

  // TOC
  const toc: TocItem[] = []
  let coverBase64 = ''
  const ncxItem = Object.values(manifest).find(i => i.mediaType === 'application/x-dtbncx+xml')
  if (ncxItem) {
    const ncxFile = zip.file(resolvePath(rootDir, ncxItem.href))
    if (ncxFile) {
      const ncxXml = await ncxFile.async('string')
      const navPoints = ncxXml.match(/<navPoint[^>]*>[\s\S]*?<\/navPoint>/g) || []
      navPoints.forEach((np, idx) => {
        const label = (extractXmlTag(np, 'navLabel') || '').replace(/<[^>]+>/g, '').trim() || `章节 ${idx + 1}`
        toc.push({ label, href: extractXmlTag(np, 'content') || '', chapterIndex: idx })
      })
    }
  }
  // Cover
  // Cover: find first meta with name="cover" and extract its content attribute
  const coverMetaMatch = opfXml.match(/<meta[^>]*name\s*=\s*["']cover["'][^>]*content\s*=\s*["']([^"']+)["'][^>]*\/?>/i)
    || opfXml.match(/<meta[^>]*content\s*=\s*["']([^"']+)["'][^>]*name\s*=\s*["']cover["'][^>]*\/?>/i)
  const coverId = coverMetaMatch?.[1]
  if (coverId && manifest[coverId]) {
    const cf = zip.file(resolvePath(rootDir, manifest[coverId].href))
    if (cf) { const d = await cf.async('arraybuffer'); coverBase64 = arrayToDataUrl(d, manifest[coverId].mediaType) }
  }

  // Parse chapters
  const chapters: ChapterContent[] = []
  for (let i = 0; i < spine.length; i++) {
    const item = manifest[spine[i]]
    if (!item) continue
    const f = zip.file(resolvePath(rootDir, item.href))
    if (!f) continue
    const raw = sanitizeEpubContent(await f.async('string'))
    const body = (raw.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [])[1] || raw
    let chTitle = toc[i]?.label || ''
    if (!chTitle) { const h = body.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i); chTitle = h ? h[1].replace(/<[^>]+>/g, '').trim() : `第 ${i + 1} 章` }
    chapters.push({ title: chTitle, content: body })
  }

  const wordCount = chapters.reduce((s, c) => s + countWords(c.content), 0)
  return { metadata: { title, author, cover: coverBase64, format: 'epub' }, chapters, rawToc: toc }
}

// ========== TXT ==========

async function parseTxt(fileData: ArrayBuffer, fileName: string): Promise<ParsedBook> {
  const data = new Uint8Array(fileData)
  const text = decodeTextBest(data)

  const title = fileName.replace(/\.txt$/i, '')
  const author = detectAuthor(text, title, 'txt')
  const chapters = splitChapters(text, title)
  const wordCount = chapters.reduce((s, c) => s + countWords(c.content), 0)

  return {
    metadata: { title, author, cover: '', format: 'txt' },
    chapters,
    rawToc: chapters.map((c, i) => ({ label: c.title, href: '', chapterIndex: i })),
    rawContent: text.slice(0, 10000)
  }
}

// ========== Markdown ==========

async function parseMarkdown(fileData: ArrayBuffer, fileName: string): Promise<ParsedBook> {
  const data = new Uint8Array(fileData)
  const text = decodeTextBest(data)
  const { marked } = await import('marked')
  const title = fileName.replace(/\.(md|markdown)$/i, '')
  const author = detectAuthor(text, title, 'markdown')

  const chapters: ChapterContent[] = []
  const headingMatches = [...text.matchAll(/^(#{1,3})\s+(.+)$/gm)]
  const parseOpts = { breaks: true, gfm: true }
  if (headingMatches.length === 0) {
    chapters.push({ title, content: await marked.parse(text, parseOpts) })
  } else {
    for (let i = 0; i < headingMatches.length; i++) {
      const start = headingMatches[i].index!
      const end = i + 1 < headingMatches.length ? headingMatches[i + 1].index! : text.length
      chapters.push({ title: headingMatches[i][2].trim(), content: await marked.parse(text.slice(start, end), parseOpts) })
    }
  }
  const wordCount = chapters.reduce((s, c) => s + countWords(c.content), 0)
  return { metadata: { title, author, cover: '', format: 'markdown' }, chapters, rawToc: chapters.map((c, i) => ({ label: c.title, href: '', chapterIndex: i })), rawContent: text.slice(0, 10000) }
}

// ========== HTML ==========

async function parseHtml(fileData: ArrayBuffer, fileName: string): Promise<ParsedBook> {
  const data = new Uint8Array(fileData)
  let text = decodeTextBest(data)
  const charsetMatch = text.match(/charset=["']?([^"'\s>]+)/i)
  if (charsetMatch && charsetMatch[1].toLowerCase() !== 'utf-8') {
    try {
      const retry = new TextDecoder(charsetMatch[1] as any).decode(data)
      if (!retry.includes('\ufffd') || (retry.match(/\ufffd/g) || []).length < (text.match(/\ufffd/g) || []).length) {
        text = retry
      }
    } catch {}
  }
  const body = ((text.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [])[1] || text)
  const cleaned = sanitizeEpubContent(body)
  const title = fileName.replace(/\.html?$/i, '')
  const author = detectAuthor(text, title, 'html')

  const hMatches = [...cleaned.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
  const chapters: ChapterContent[] = []
  if (hMatches.length === 0) {
    chapters.push({ title, content: cleaned })
  } else {
    for (let i = 0; i < hMatches.length; i++) {
      const start = hMatches[i].index!
      const end = i + 1 < hMatches.length ? hMatches[i + 1].index! : cleaned.length
      chapters.push({ title: hMatches[i][1].trim(), content: cleaned.slice(start, end) })
    }
  }
  return { metadata: { title, author, cover: '', format: 'html' }, chapters, rawToc: chapters.map((c, i) => ({ label: c.title, href: '', chapterIndex: i })), rawContent: text.slice(0, 10000) }
}

// ========== MOBI/AZW3 ==========

async function parseMobi(fileData: ArrayBuffer, fileName: string, format: 'mobi' | 'azw3'): Promise<ParsedBook> {
  const data = new Uint8Array(fileData)
  const title = fileName.replace(/\.(mobi|azw3?)$/i, '')
  let author = '未知作者'
  let text = ''

  try {
    // --- Extract metadata from PalmDOC header ---
    const titleOff = getU32(data, 84), titleLen = getU32(data, 88)
    const authorOff = getU32(data, 92), authorLen = getU32(data, 96)
    if (titleOff > 0 && titleLen > 0) {
      const t = decodeAscii(data, titleOff, titleLen)
      if (t) { /* title already set from fileName */ }
    }
    if (authorOff > 0 && authorLen > 0) {
      const a = decodeAscii(data, authorOff, authorLen)
      if (a) author = a
    }

    // --- Method 1: Locate MOBI header, then text records ---
    const mobiOff = findBytes(data, 'MOBI')
    if (mobiOff >= 0) {
      const headerLen = getU32(data, mobiOff + 4)
      // First text record starts at mobiOff + 16 + headerLen
      const textStart = mobiOff + 16 + headerLen

      // Method 1a: Try to find HTML content by searching for <html...>...</html>
      const htmlStart = findBytes(data, '<html', textStart)
      if (htmlStart >= 0 && htmlStart < textStart + 50000) {
        const htmlEnd = findBytes(data, '</html>', htmlStart)
        if (htmlEnd >= 0) {
          text = decodeAscii(data, htmlStart, htmlEnd + 7 - htmlStart)
        } else {
          // Method 1b: No closing html tag — take from htmlStart to end of file
          text = decodeAscii(data, htmlStart, data.length - htmlStart)
        }
      }

      // Method 1c: Fallback — try searching for <body...> if <html> not found
      if (!text) {
        const bodyStart = findBytes(data, '<body', textStart)
        if (bodyStart >= 0 && bodyStart < textStart + 100000) {
          const bodyEnd = findBytes(data, '</body>', bodyStart)
          if (bodyEnd >= 0) {
            text = decodeAscii(data, bodyStart, bodyEnd + 7 - bodyStart)
          }
        }
      }

      // Method 1d: Plain text extraction from raw records (skip HTML search)
      if (!text) {
        const rawText = decodeAscii(data, textStart, Math.min(500000, data.length - textStart))
        if (rawText.length > 100) {
          // Check if text is a meaningful string (not binary garbage)
          const printable = rawText.replace(/[\x00-\x1f\x7f-\x9f]/g, '')
          if (printable.length > rawText.length * 0.3) {
            text = rawText
          }
        }
      }
    }

    // --- Method 2: If MOBI header not found, search whole file for content ---
    if (!text) {
      const fh = findBytes(data, '<html')
      if (fh >= 0) {
        const fe = findBytes(data, '</html>', fh)
        text = fe >= 0 ? decodeAscii(data, fh, fe + 7 - fh) : decodeAscii(data, fh, data.length - fh)
      }
    }

    // --- Method 3: Try decoding as UTF-8/GBK text after skipping binary header ---
    if (!text) {
      const candidates = [0, 100, 200, 500]
      for (const skip of candidates) {
        if (skip >= data.length) continue
        const raw = decodeTextBest(data.slice(skip))
        const sig = raw.slice(0, 200).toLowerCase()
        if (sig.includes('<html') || sig.includes('<body') || sig.includes('<p') || sig.includes('<div')) {
          text = raw
          break
        }
        // Keep the best candidate even if no HTML tags (plain text MOBI)
        if (raw.length > (text || '').length && raw.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').length > raw.length * 0.5) {
          text = raw
        }
      }
    }
  } catch {}

  if (!text) {
    text = '<p>无法解析 MOBI/AZW3 文本内容，文件已保留。</p>'
    logger.warn(`MOBI/AZW3 文本提取失败: ${fileName}`)
  }

  const cleaned = sanitizeEpubContent(text)
  const chapters = splitHtmlChapters(cleaned, title)
  const wordCount = chapters.reduce((s, c) => s + countWords(c.content), 0)

  return {
    metadata: { title, author, cover: '', format },
    chapters,
    rawToc: chapters.map((c, i) => ({ label: c.title, href: '', chapterIndex: i })),
    rawContent: text.slice(0, 10000)
  }
}

// ========== FB2 ==========

async function parseFb2(fileData: ArrayBuffer, fileName: string): Promise<ParsedBook> {
  const data = new Uint8Array(fileData)
  let xml = decodeTextBest(data)
  const encMatch = xml.match(/encoding=["']([^"']+)["']/)
  if (encMatch && encMatch[1].toLowerCase() !== 'utf-8') {
    try {
      const retry = new TextDecoder(encMatch[1] as any).decode(data)
      if (!retry.includes('\ufffd') || (retry.match(/\ufffd/g) || []).length < (xml.match(/\ufffd/g) || []).length) {
        xml = retry
      }
    } catch {}
  }

  const title = extractXmlTag(xml, 'book-title') || fileName.replace(/\.fb2$/i, '')
  const first = extractXmlTag(xml, 'first-name') || ''
  const last = extractXmlTag(xml, 'last-name') || ''
  const author = [first, last].filter(Boolean).join(' ') || '未知作者'

  const sections = xml.match(/<section>[\s\S]*?<\/section>/g) || []
  const chapters: ChapterContent[] = []
  let coverBase64 = ''

  if (sections.length === 0) {
    const body = (xml.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [])[1]
    if (body) chapters.push({ title: '正文', content: sanitizeEpubContent(body) })
  } else {
    sections.forEach((sec, i) => {
      const t = (extractXmlTag(sec, 'title') || '').replace(/<[^>]+>/g, '').trim() || `章节 ${i + 1}`
      chapters.push({ title: t, content: sanitizeEpubContent(sec.replace(/<title>[\s\S]*?<\/title>/, '')) })
    })
  }

  const cpMatch = xml.match(/<coverpage>[\s\S]*?<\/coverpage>/)
  if (cpMatch) {
    const hm = cpMatch[0].match(/href=["']#([^"']+)["']/)
    if (hm) {
      const escapedId = hm[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const bm = xml.match(new RegExp(`<binary[^>]*id=["']${escapedId}["'][^>]*content-type=["']([^"']+)["'][^>]*>([^<]*)</binary>`, 'i'))
      if (bm) coverBase64 = arrayToDataUrl(base64ToBytes(bm[2].trim()).buffer, bm[1])
    }
  }

  const wordCount = chapters.reduce((s, c) => s + countWords(c.content), 0)
  return { metadata: { title, author, cover: coverBase64, format: 'fb2' }, chapters, rawToc: chapters.map((c, i) => ({ label: c.title, href: '', chapterIndex: i })), rawContent: xml.slice(0, 10000) }
}

// ========== DJVU ==========

async function parseDjvu(fileData: ArrayBuffer, fileName: string): Promise<ParsedBook> {
  const title = fileName.replace(/\.djvu$/i, '')
  const data = new Uint8Array(fileData)

  // DJVU is a binary format; extract ASCII-readable text segments from known text chunks
  const pageTexts: string[] = []
  try {
    // Search for DJVU TXTz annotations: FORM:DjVu -> TXTz chunk with DEFLATE-compressed text
    let offset = 0
    while (offset < data.length - 8) {
      // Find TXTz fourcc
      const txtzIdx = findBytes(data, 'TXt', offset)
      if (txtzIdx < 0 || txtzIdx + 12 > data.length) break
      const chunkLen = getU24BE(data, txtzIdx + 4)
      if (chunkLen < 1 || chunkLen > 10 * 1024 * 1024) { offset = txtzIdx + 1; continue }
      const chunkData = data.slice(txtzIdx + 8, txtzIdx + 8 + chunkLen)
      try {
        // Try decompressing as DEFLATE (zlib)
        const decompressed = decompressZlib(chunkData)
        const decoded = new TextDecoder('utf-8', { fatal: false }).decode(decompressed)
        const cleaned = decoded.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').trim()
        if (cleaned.length > 10) pageTexts.push(cleaned)
      } catch { /* ignore uncompressable chunks */ }
      offset = txtzIdx + 8 + chunkLen
    }
  } catch { /* DJVU extraction failed */ }

  // Fallback: try raw text extraction from visible ASCII
  if (pageTexts.length === 0) {
    let raw = ''
    for (let i = 0; i < Math.min(data.length, 1000000); i++) {
      const b = data[i]
      if ((b >= 32 && b < 127) || b === 10 || b === 13 || (b >= 192)) {
        raw += String.fromCharCode(b)
      } else if (b === 0 || (b < 32 && b !== 10 && b !== 13)) {
        raw += ' '
      }
    }
    const collapsed = raw.replace(/\s{3,}/g, '\n').trim()
    if (collapsed.length > 50) pageTexts.push(collapsed)
  }

  const author = detectAuthor(pageTexts.join('\n'), title, 'djvu')

  const chapters: ChapterContent[] = pageTexts.length > 0
    ? batchArray(pageTexts, Math.max(1, Math.ceil(pageTexts.length / 20))).map((batch, i) => ({
        title: `第 ${i + 1} 部分`,
        content: batch.map(p => `<p>${escapeHtml(p)}</p>`).join('\n')
      }))
    : [{ title, content: `<p>无法解析 "${fileName}" 的 DJVU 文本内容。该文件可能是纯扫描版 DJVU，不含文本层。</p>` }]

  return { metadata: { title, author, cover: '', format: 'djvu' }, chapters, rawToc: chapters.map((c, i) => ({ label: c.title, href: '', chapterIndex: i })) }
}

// ========== DOCX/RTF/ODT ==========

async function parseDocx(fileData: ArrayBuffer, fileName: string, format: 'docx' | 'rtf' | 'odt'): Promise<ParsedBook> {
  const title = fileName.replace(new RegExp(`\\.${format}$`, 'i'), '')
  let html = ''
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.convertToHtml({ arrayBuffer: fileData })
    html = result.value || ''
  } catch { html = `<p>无法解析 ${format.toUpperCase()} 文件</p>` }

  const cleaned = sanitizeEpubContent(html)
  const body = ((cleaned.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [])[1] || cleaned)
  const author = detectAuthor(html.replace(/<[^>]+>/g, ' '), title, format)
  const chapters = splitHtmlChapters(body, title)
  const wordCount = chapters.reduce((s, c) => s + countWords(c.content), 0)

  return { metadata: { title, author, cover: '', format }, chapters, rawToc: chapters.map((c, i) => ({ label: c.title, href: '', chapterIndex: i })) }
}

// ========== PDF ==========

async function parsePdf(fileData: ArrayBuffer, fileName: string): Promise<ParsedBook> {
  const title = fileName.replace(/\.pdf$/i, '')
  const chapters: ChapterContent[] = []
  let rawText = ''

  try {
    const pdfjsLib = await import('pdfjs-dist')
    // Use the bundled worker; empty string = no external worker, runs main-thread
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = ''
    }
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(fileData) }).promise
    const pageTexts: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const tc = await page.getTextContent()
      const pt = tc.items.map((x: any) => x.str || '').join(' ')
      if (pt.trim()) pageTexts.push(pt)
    }
    rawText = pageTexts.join('\n')
    if (pageTexts.length > 0) {
      const author = detectAuthor(rawText, title, 'pdf')
      batchArray(pageTexts, Math.max(1, Math.ceil(pageTexts.length / 20))).forEach((batch, i) => {
        chapters.push({ title: `第 ${i + 1} 部分`, content: batch.map(p => `<p>${escapeHtml(p)}</p>`).join('\n') })
      })
    }
  } catch (e) {
    logger.error(`PDF 解析失败: ${fileName}`, e)
  }

  if (chapters.length === 0) {
    chapters.push({
      title,
      content: `<p>无法提取 "${fileName}" 的文本内容。该 PDF 可能是扫描版图片 PDF，或包含加密/受限的文本层。文件已保留，可尝试在其他阅读器中打开。</p>`
    })
  }
  const wordCount = chapters.reduce((s, c) => s + countWords(c.content), 0)
  return {
    metadata: { title, author: '未知作者', cover: '', format: 'pdf' },
    chapters,
    rawToc: chapters.map((c, i) => ({ label: c.title, href: '', chapterIndex: i })),
    rawContent: rawText.slice(0, 10000)
  }
}

// ========== Comic ==========

async function parseComic(fileData: ArrayBuffer, fileName: string, format: 'cbr' | 'cbz' | 'cbt' | 'cb7'): Promise<ParsedBook> {
  const title = fileName.replace(new RegExp(`\\.${format}$`, 'i'), '')
  let images: string[] = []
  try {
    if (format === 'cbz') {
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(fileData)
      images = Object.keys(zip.files).filter(n => ['jpg','jpeg','png','gif','webp','bmp'].includes((n.split('.').pop()||'').toLowerCase())).sort()
    } else { images = ['图片文件'] }
  } catch { images = ['图片文件'] }

  const chapters: ChapterContent[] = images.map((_, i) => ({
    title: `第 ${i + 1} 页`,
    content: `<div class="comic-page"><p class="comic-page-num">第 ${i + 1} 页 / 共 ${images.length} 页</p></div>`
  }))

  return { metadata: { title, author: '未知作者', cover: '', format }, chapters, rawToc: chapters.map((c, i) => ({ label: c.title, href: '', chapterIndex: i })) }
}

// ========== Utilities ==========

function splitHtmlChapters(html: string, fallbackTitle: string): ChapterContent[] {
  const matches = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
  if (matches.length === 0) return [{ title: fallbackTitle, content: html }]
  const chapters: ChapterContent[] = []
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index!
    const end = i + 1 < matches.length ? matches[i + 1].index! : html.length
    chapters.push({ title: matches[i][1].trim(), content: html.slice(start, end) })
  }
  return chapters
}

function extractXmlTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'))
  return m ? m[1].trim() : null
}

function extractAttr(el: string, attr: string): string {
  const m = el.match(new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, 'i'))
  return m ? m[1] : ''
}

function resolvePath(base: string, rel: string): string {
  return rel.startsWith('/') ? rel.slice(1) : base + rel
}

export function countWords(text: string): number {
  const s = text.replace(/<[^>]+>/g, '')
  return ((s.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length) + s.split(/\s+/).filter(w => w.length > 0).length
}

export function detectTags(text: string): string[] {
  const tags = new Set<string>()
  const lines = text.split(/\r?\n/).slice(0, 100)
  const block = lines.join('\n')

  // --- Aggressive #hashtag detection ---
  // Matches # followed by 1-30 non-whitespace, non-punctuation chars
  // Catches: #群交 #魔法使いの嫁 #furry #恶堕 #兽人 #emoji🎉 #tag1 #小说
  const hashRegex = /#[^\s#.,;:!?，。；：！？\n]{1,30}/g
  let m: RegExpExecArray | null
  while ((m = hashRegex.exec(block)) !== null) {
    const tag = m[0].replace(/^[#＃]+/, '').trim()
    if (tag.length >= 1 && tag.length <= 30) tags.add(tag)
  }

  // --- Label-based detection: 标签：xxx / Tags：xxx / 关键词：xxx ---
  const labelPatterns = [
    /标签[：:]\s*(.+)/i,
    /Tags?[：:]\s*(.+)/i,
    /关键词[：:]\s*(.+)/i,
    /Keywords?[：:]\s*(.+)/i,
  ]
  for (const p of labelPatterns) {
    const lm = block.match(p)
    if (lm && lm[1]) {
      // Split by comma, Chinese comma, semicolon, Chinese semicolon, Chinese enumeration comma, space
      lm[1].split(/[,，;；、\s]+/).forEach(t => {
        const tag = t.trim().replace(/^[#＃]+/, '')
        if (tag.length >= 1 && tag.length <= 30) tags.add(tag)
      })
    }
  }

  // --- Repeat on per-line basis for bare hashtags mixed in text ---
  // e.g. "这是一本#小说 很好看" — the line-by-line pass ensures we don't miss
  // tags that might be near line boundaries or after the initial scan
  for (const line of lines) {
    let lm2: RegExpExecArray | null
    hashRegex.lastIndex = 0
    while ((lm2 = hashRegex.exec(line)) !== null) {
      const tag = lm2[0].replace(/^[#＃]+/, '').trim()
      if (tag.length >= 1 && tag.length <= 30) tags.add(tag)
    }
  }

  return Array.from(tags).slice(0, 10)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function arrayToDataUrl(buf: ArrayBuffer, mime: string): string {
  const b = new Uint8Array(buf); let s = ''
  for (let i=0; i<b.byteLength; i++) s += String.fromCharCode(b[i])
  return `data:${mime};base64,${btoa(s)}`
}

function base64ToBytes(b64: string): Uint8Array {
  const b = atob(b64); const r = new Uint8Array(b.length)
  for (let i=0; i<b.length; i++) r[i] = b.charCodeAt(i)
  return r
}

function decodeAscii(d: Uint8Array, off: number, len: number): string {
  let r = ''; for (let i=off; i<Math.min(off+len, d.length) && d[i]!==0; i++) r += String.fromCharCode(d[i])
  return r.trim()
}

function getU32(d: Uint8Array, off: number): number {
  return off+4 <= d.length ? (d[off]<<24)|(d[off+1]<<16)|(d[off+2]<<8)|d[off+3] : 0
}

function getU24BE(d: Uint8Array, off: number): number {
  return off+3 <= d.length ? (d[off]<<16)|(d[off+1]<<8)|d[off+2] : 0
}

function decompressZlib(chunk: Uint8Array): Uint8Array {
  // Browser DecompressionStream is async-only; text fallback below handles raw bytes.
  // Return the chunk as-is — the ASCII extraction pass will pick up readable text.
  return chunk
}

function findBytes(d: Uint8Array, s: string, start=0): number {
  const b = new TextEncoder().encode(s)
  for (let i=start; i<=d.length-b.length; i++) {
    let ok=true; for(let j=0;j<b.length;j++){if(d[i+j]!==b[j]){ok=false;break}}
    if(ok) return i
  }
  return -1
}

function batchArray<T>(arr: T[], size: number): T[][] {
  const r: T[][] = []; for (let i=0; i<arr.length; i+=size) r.push(arr.slice(i,i+size)); return r
}

// ========== Worker Factories ==========

/**
 * Create a parse worker using Vite's native Worker bundling.
 * This is the primary, production-recommended pattern.
 * Vite detects `new URL(..., import.meta.url)` and bundles the worker as a separate chunk.
 */
export function createParseWorker(): Worker {
  return new Worker(new URL('./parse-worker.ts', import.meta.url), { type: 'module' })
}

/**
 * Create an inline parse worker from a Blob URL.
 * Used as a fallback when Vite's static-analysis pattern is not available.
 *
 * Note: In production, Vite bundles the worker via import.meta.url transform.
 * This factory exists for environments where the native Worker constructor fails.
 * The fetched code will be served by Vite's dev server (transformed) in dev,
 * and as a bundled chunk in production.
 */
export async function createInlineParseWorker(): Promise<Worker> {
  const workerUrl = new URL('./parse-worker.ts', import.meta.url)
  try {
    // Vite transforms worker imports; try direct construction first
    return new Worker(workerUrl, { type: 'module' })
  } catch {
    // Fallback: fetch the compiled code and create from Blob
    const response = await fetch(workerUrl.href)
    const code = await response.text()
    const blob = new Blob([code], { type: 'application/javascript' })
    const blobUrl = URL.createObjectURL(blob)
    const worker = new Worker(blobUrl, { type: 'module' })
    URL.revokeObjectURL(blobUrl)
    return worker
  }
}

/**
 * Send a parse request to the worker and return a promise that resolves with the result.
 * Transfers the ArrayBuffer for zero-copy performance.
 */
export function workerParse(
  worker: Worker,
  filePath: string,
  fileName: string,
  fileData: ArrayBuffer,
  fileSize: number,
  onProgress?: (message: string) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    worker.onmessage = (e: MessageEvent) => {
      const { type, data, error, message } = e.data || {}
      switch (type) {
        case 'result':
          resolve(data)
          break
        case 'error':
          reject(new Error(error || 'Unknown worker error'))
          break
        case 'progress':
          onProgress?.(message || '')
          break
      }
    }
    worker.onerror = (e: ErrorEvent) => {
      reject(new Error(e.message || 'Worker error'))
    }
    // Transfer the ArrayBuffer to avoid copying large files
    worker.postMessage({ filePath, fileName, fileData, fileSize }, [fileData])
  })
}
