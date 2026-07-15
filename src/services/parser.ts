import type { BookFormat, ParsedBook, ChapterContent, TocItem } from '@/types'
import { sanitizeEpubContent } from './sanitize'
import { logger } from './log'
import { arrayBufferToBase64 } from './base64'
import { MAX_FILE_SIZE, MAX_EPUB_FILES, AUTHOR_PATTERNS, CHAPTER_PATTERNS, ALLOWED_FORMATS, SUPPORTED_FORMATS } from '@/constants'

// ========== Encoding detection ==========

/** Priority-ordered encodings to try for text files without BOM */
const TXT_ENCODINGS = [
  'utf-8', 'gb18030', 'gbk', 'gb2312', 'big5',
  'shift_jis', 'euc-jp', 'iso-2022-jp', 'euc-kr', 'euc-tw', 'utf-16le', 'utf-16be'
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
    case 'fb2': return parseFb2(fileData, fileName)
    case 'djvu': return parseDjvu(fileData, fileName)
    case 'docx': case 'rtf': case 'odt': return parseDocx(fileData, fileName, format)
    case 'pdf': return parsePdf(fileData, fileName)
    case 'cbr': case 'cbz': case 'cbt': case 'cb7': return parseComic(fileData, fileName, format)
    case 'chm': return parseChm(fileData, fileName)
    case 'lit': return parseLit(fileData, fileName)
    case 'lrf': return parseLrf(fileData, fileName)
    default: throw new Error(`不支持的文件格式: ${fileName}`)
  }
}

export function detectFormat(fileName: string): BookFormat {
  const ext = fileName.toLowerCase().split('.').pop() || ''
  const map: Record<string, BookFormat> = {
    'epub': 'epub', 'txt': 'txt', 'md': 'markdown', 'markdown': 'markdown',
    'html': 'html', 'htm': 'html',
    'fb2': 'fb2', 'djvu': 'djvu', 'docx': 'docx', 'rtf': 'rtf', 'odt': 'odt',
    'pdf': 'pdf', 'cbr': 'cbr', 'cbz': 'cbz', 'cbt': 'cbt', 'cb7': 'cb7',
    'chm': 'chm', 'lit': 'lit', 'lrf': 'lrf'
  }
  const format = map[ext]
  if (!format) throw new Error(`未知文件格式: ${ext}`)
  // Whitelist gate: reject disabled formats
  if (!isFormatAllowed(format)) {
    const label = SUPPORTED_FORMATS.find(f => f.value === format)?.label || format.toUpperCase()
    throw new Error(`${label} 格式暂不支持，请转换为 EPUB 后导入`)
  }
  return format
}

function isFormatAllowed(fmt: BookFormat): boolean {
  return ALLOWED_FORMATS.has(fmt)
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

  // TOC: prefer NCX (EPUB2), fall back to EPUB3 nav.xhtml
  const toc: TocItem[] = []
  let ncxDir = rootDir
  const ncxItem = Object.values(manifest).find(i => i.mediaType === 'application/x-dtbncx+xml')
  if (ncxItem) {
    const ncxPath = resolvePath(rootDir, ncxItem.href)
    ncxDir = ncxPath.includes('/') ? ncxPath.substring(0, ncxPath.lastIndexOf('/') + 1) : ''
    const ncxFile = zip.file(ncxPath)
    if (ncxFile) {
      const ncxXml = await ncxFile.async('string')
      const navPoints = ncxXml.match(/<navPoint[^>]*>[\s\S]*?<\/navPoint>/g) || []
      navPoints.forEach((np, idx) => {
        const label = (extractXmlTag(np, 'navLabel') || '').replace(/<[^>]+>/g, '').trim() || `章节 ${idx + 1}`
        toc.push({ label, href: extractXmlTag(np, 'content') || '', chapterIndex: -1 })
      })
    }
  }

  // EPUB3 nav.xhtml fallback
  if (toc.length === 0) {
    const navItem = Object.values(manifest).find(i =>
      i.href.endsWith('nav.xhtml') || i.href.endsWith('nav.html') ||
      ((i as any).properties && (i as any).properties.includes('nav'))
    )
    if (navItem) {
      const navFile = zip.file(resolvePath(rootDir, navItem.href))
      if (navFile) {
        const navHtml = await navFile.async('string')
        const links = navHtml.match(/<a\b[^>]*href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi) || []
        links.forEach((a, idx) => {
          const hrefMatch = a.match(/href\s*=\s*["']([^"']*)["']/) || []
          const text = (a.match(/>([\s\S]*?)<\/a>/i) || [])[1]?.replace(/<[^>]+>/g, '').trim() || ''
          toc.push({ label: text || `章节 ${idx + 1}`, href: hrefMatch[1] || '', chapterIndex: -1 })
        })
      }
    }
  }
  // Cover
  let coverBase64 = ''
  // Primary: find <meta name="cover" content="cover-id"/> in the OPF metadata
  const coverMetaMatch = opfXml.match(/<meta[^>]*name\s*=\s*["']cover["'][^>]*content\s*=\s*["']([^"']+)["'][^>]*\/?>/i)
    || opfXml.match(/<meta[^>]*content\s*=\s*["']([^"']+)["'][^>]*name\s*=\s*["']cover["'][^>]*\/?>/i)
  let coverId = coverMetaMatch?.[1]

  // Fallback: EPUB 2 <guide> may contain a <reference type="cover" href="..."/> pointing to a cover page or image
  if (!coverId || !manifest[coverId]) {
    const guideCoverMatch = opfXml.match(/<reference[^>]*type\s*=\s*["']cover["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*\/?>/i)
    const guideHref = guideCoverMatch?.[1]
    if (guideHref) {
      // The guide href may point to an HTML cover page (e.g. "cover.html") or directly to an image.
      // We check the manifest for an item whose href matches this guide reference.
      for (const [id, item] of Object.entries(manifest)) {
        if (item.href === guideHref || item.href.endsWith('/' + guideHref)) {
          coverId = id
          break
        }
      }
    }
  }

  if (coverId && manifest[coverId]) {
    const cf = zip.file(resolvePath(rootDir, manifest[coverId].href))
    if (cf) {
      // Limit cover image to 5MB to avoid memory bloat from huge cover images
      const COVER_MAX_SIZE = 5 * 1024 * 1024
      const d = await cf.async('arraybuffer')
      if (d.byteLength <= COVER_MAX_SIZE) {
        coverBase64 = dataUrl(d, manifest[coverId].mediaType)
      } else {
        logger.warn(`封面图片过大 (${(d.byteLength / 1024 / 1024).toFixed(1)}MB)，跳过`)
      }
    }
  }

  // Parse chapters
  const chapters: ChapterContent[] = []
  for (let i = 0; i < spine.length; i++) {
    const item = manifest[spine[i]]
    if (!item) continue
    const chapterPath = resolvePath(rootDir, item.href)
    const f = zip.file(chapterPath)
    if (!f) continue
    const raw = sanitizeEpubContent(await f.async('string'))
    let body = (raw.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [])[1] || raw
    // Embed images as data URIs
    const chapterDir = chapterPath.includes('/') ? chapterPath.substring(0, chapterPath.lastIndexOf('/') + 1) : ''
    body = await embedImages(body, chapterDir, rootDir, zip)
    let chTitle = toc.find(t => t.chapterIndex === chapters.length)?.label || ''
    if (!chTitle) {
      const h = body.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)
      if (h) {
        chTitle = h[1].replace(/<[^>]+>/g, '').trim()
      }
    }
    if (!chTitle) {
      const inlinePatterns = [
        /第[零一二三四五六七八九十百千0-9]+[章节节卷部回篇集輯]\s*[：:]?\s*(.+)?/,
        /第[零一二三四五六七八九十百千0-9]+[卷部回篇]?\s+[^\s<>]{2,30}/,
        /^Chapter\s+\d+/i, /^Part\s+\d+/i, /^Section\s+\d+/i,
        /(序言|前言|楔子|引子|番外|后记|尾声|附录)/,
        /(Prologue|Epilogue|Foreword|Preface|Introduction|Appendix)/i,
      ]
      for (const p of inlinePatterns) {
        const m = body.match(p)
        if (m) { chTitle = m[0].replace(/<[^>]+>/g, '').trim(); break }
      }
      if (!chTitle) chTitle = `第 ${i + 1} 章`
    }
    chapters.push({ title: chTitle, content: body })
  }

  // Resolve TOC items against actual chapter indices
  const chapterHrefToIndex: Record<string, number> = {}
  for (let ci = 0; ci < chapters.length; ci++) {
    // Re-derive the manifest href for this chapter
    const chSpineIdx = spine.findIndex(sid => {
      const item = manifest[sid]
      if (!item) return false
      const p = resolvePath(rootDir, item.href)
      return zip.file(p) !== null
    })
    // Use the manifest href for matching
    let actualIdx = 0
    for (let si = 0; si < spine.length; si++) {
      const item = manifest[spine[si]]
      if (!item) continue
      const cp = resolvePath(rootDir, item.href)
      const f = zip.file(cp)
      if (!f) continue
      if (actualIdx === ci) {
        const resolved = normalizeTextRef(rootDir, item.href)
        chapterHrefToIndex[resolved] = ci
        break
      }
      actualIdx++
    }
  }

  for (const ti of toc) {
    if (!ti.href || ti.chapterIndex >= 0) continue
    const baseHref = ti.href.split('#')[0]
    // Resolve relative to NCX directory (for EPUB2) or OPF root (for EPUB3)
    const refDir = ncxItem ? ncxDir : rootDir
    const resolved = normalizeTextRef(refDir, baseHref)
    if (chapterHrefToIndex[resolved] !== undefined) {
      ti.chapterIndex = chapterHrefToIndex[resolved]
    }
    if (ti.chapterIndex < 0) {
      for (const [rhref, cidx] of Object.entries(chapterHrefToIndex)) {
        if (rhref.endsWith('/' + baseHref) || rhref.endsWith(baseHref)) {
          ti.chapterIndex = cidx
          break
        }
      }
    }
  }

  // Assign sequential fallback indices and fix chapter titles
  let seqIdx = 0
  const usedIndices = new Set<number>()
  for (const ti of toc) {
    if (ti.chapterIndex < 0) {
      while (usedIndices.has(seqIdx)) seqIdx++
      ti.chapterIndex = seqIdx
    }
    usedIndices.add(ti.chapterIndex)
  }

  // Apply TOC titles to chapters
  for (const ti of toc) {
    if (ti.chapterIndex >= 0 && ti.chapterIndex < chapters.length) {
      const ch = chapters[ti.chapterIndex]
      if (ch && (ch.title.startsWith('第 ') || ch.title.startsWith('Chapter ') || !ch.title)) {
        ch.title = ti.label
      }
    }
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
    } catch { /* 编码重试失败，使用原始文本 */ }
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
    } catch { /* 编码重试失败，使用原始 XML */ }
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
      if (bm) coverBase64 = dataUrl(base64ToBytes(bm[2].trim()).buffer, bm[1])
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
        const decompressed = await decompressZlib(chunkData)
        const decoded = new TextDecoder('utf-8', { fatal: false }).decode(decompressed)
        const cleaned = decoded.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').trim()
        if (cleaned.length > 10) pageTexts.push(cleaned)
      } catch { /* ignore uncompressable chunks */ }
      offset = txtzIdx + 8 + chunkLen
    }
  } catch { /* DJVU extraction failed */ }

  // Fallback: try raw text extraction from visible ASCII
  if (pageTexts.length === 0) {
    const chars: string[] = []
    const max = Math.min(data.length, 1000000)
    for (let i = 0; i < max; i++) {
      const b = data[i]
      if ((b >= 32 && b < 127) || b === 10 || b === 13 || (b >= 192)) {
        chars.push(String.fromCharCode(b))
      } else if (b === 0 || (b < 32 && b !== 10 && b !== 13)) {
        chars.push(' ')
      }
    }
    const raw = chars.join('')
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

const PDF_MAX_PAGES = 500
const PDF_LARGE_FILE_BYTES = 100 * 1024 * 1024 // 100 MB

async function parsePdf(fileData: ArrayBuffer, fileName: string): Promise<ParsedBook> {
  const title = fileName.replace(/\.pdf$/i, '')
  const chapters: ChapterContent[] = []
  let rawText = ''
  let errorDetail = ''

  if (fileData.byteLength > PDF_LARGE_FILE_BYTES) {
    logger.warn(`大 PDF 文件 (${(fileData.byteLength / 1024 / 1024).toFixed(1)}MB): ${fileName}，渲染可能较慢`)
  }

  // Try raw binary text extraction as fallback
  const rawBinary = new Uint8Array(fileData)
  const rawBinaryText = decodeTextBest(rawBinary.slice(0, Math.min(rawBinary.length, 2000000)))
  const hasRawText = rawBinaryText.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').length > 100
  let author = '未知作者'

  try {
    const pdfjsLib = await import('pdfjs-dist')
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '' // main-thread (parsing already offloaded via parse-worker.ts)
    }
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(fileData) }).promise
    const totalPages = Math.min(pdf.numPages, PDF_MAX_PAGES)
    const truncated = pdf.numPages > PDF_MAX_PAGES

    const pageTexts: string[] = []
    let hasAnyText = false

    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i)
      const tc = await page.getTextContent()
      const pt = tc.items.map((x: any) => x.str || '').join(' ').trim()
      if (pt) { pageTexts.push(pt); hasAnyText = true } else { pageTexts.push('') }
    }

    rawText = pageTexts.join('\n')
    author = detectAuthor(rawText || rawBinaryText, title, 'pdf')

    if (hasAnyText) {
      // Normal text-based PDF: batch pages into chapters with text data
      const batchSize = Math.max(1, Math.ceil(totalPages / 20))
      const pageStartIndices = batchArray(
        Array.from({ length: totalPages }, (_, i) => i + 1),
        batchSize
      )
      pageStartIndices.forEach((pageNums, batchIdx) => {
        const parts: string[] = []
        for (const pageNum of pageNums) {
          const textIdx = pageNum - 1
          const pageText = pageTexts[textIdx] || ''
          const escapedText = escapeHtml(pageText).replace(/"/g, '&quot;')
          parts.push(
            `<div class="pdf-page" data-page="${pageNum}" data-text="${escapedText}">` +
            `<div class="pdf-page-img-container" data-page="${pageNum}">` +
            `<div class="pdf-page-placeholder">第 ${pageNum} 页</div>` +
            `</div></div>`
          )
        }
        chapters.push({ title: `第 ${batchIdx + 1} 部分`, content: parts.join('\n') })
      })
    } else {
      // Scanned/image PDF — no text layer. Build image-only chapters.
      const batchSize = Math.max(1, Math.ceil(totalPages / 10))
      const pageStartIndices = batchArray(
        Array.from({ length: totalPages }, (_, i) => i + 1),
        batchSize
      )
      pageStartIndices.forEach((pageNums, batchIdx) => {
        const parts: string[] = []
        parts.push(`<p class="pdf-scanned-notice">📷 此 PDF 为扫描版（无文本层），以下为图片页面。</p>`)
        for (const pageNum of pageNums) {
          parts.push(
            `<div class="pdf-page" data-page="${pageNum}" data-text="">` +
            `<div class="pdf-page-img-container" data-page="${pageNum}">` +
            `<div class="pdf-page-placeholder">第 ${pageNum} 页（点击加载图片）</div>` +
            `</div></div>`
          )
        }
        chapters.push({ title: `第 ${batchIdx + 1} 部分（扫描版）`, content: parts.join('\n') })
      })
    }

    if (truncated) {
      chapters.push({
        title: '⚠️ 截断提示',
        content: `<div class="comic-truncation-notice"><p>⚠️ 本书共 ${pdf.numPages} 页，超过 ${PDF_MAX_PAGES} 页限制。仅渲染前 ${PDF_MAX_PAGES} 页，剩余 ${pdf.numPages - PDF_MAX_PAGES} 页未显示。</p></div>`
      })
    }
  } catch (e: any) {
    errorDetail = e?.message || String(e)
    logger.error(`PDF 解析失败: ${fileName}`, e)

    // Try raw binary fallback
    if (hasRawText) {
      const cleaned = sanitizeEpubContent(rawBinaryText)
      const rawChapters = splitHtmlChapters(cleaned, title)
      if (rawChapters.length > 0) {
        rawText = rawBinaryText
        rawChapters.forEach(c => chapters.push(c))
      }
    }
  }

  if (chapters.length === 0) {
    const msg = errorDetail.includes('password') || errorDetail.includes('encrypt')
      ? '此 PDF 已加密或受密码保护，无法解析。'
      : errorDetail
        ? `PDF 解析失败：${errorDetail.slice(0, 200)}`
        : '该 PDF 可能是扫描版图片 PDF，或包含加密/受限的文本层。'
    chapters.push({
      title,
      content: `<p>无法提取 "${fileName}" 的文本内容。${msg}文件已保留，可尝试在其他阅读器中打开。</p>`
    })
  }
  const wordCount = chapters.reduce((s, c) => s + countWords(c.content), 0)
  return {
    metadata: { title, author, cover: '', format: 'pdf' },
    chapters,
    rawToc: chapters.map((c, i) => ({ label: c.title, href: '', chapterIndex: i })),
    rawContent: rawText.slice(0, 10000)
  }
}

// ========== CHM (Compiled HTML Help) ==========

async function parseChm(fileData: ArrayBuffer, fileName: string): Promise<ParsedBook> {
  const data = new Uint8Array(fileData)
  const title = fileName.replace(/\.chm$/i, '')
  let text = ''

  try {
    // ITSF header: "ITSF" at offset 0, version at 4, header length at 8
    if (data.length < 40) throw new Error('File too small')
    const magic = String.fromCharCode(...data.slice(0, 4))
    if (magic !== 'ITSF') {
      // Fallback: try raw HTML extraction
      text = decodeTextBest(data)
      if (!text.includes('<html') && !text.includes('<body')) {
        return { metadata: { title, author: '未知作者', cover: '', format: 'chm' }, chapters: [{ title, content: '<p>无法解析此 CHM 文件，文件格式可能已损坏。</p>' }], rawToc: [] }
      }
    } else {
      // Extract HTML content by scanning for HTML blocks
      const htmlStarts: number[] = []
      for (let i = 0; i < data.length - 6; i++) {
        if (data[i] === 0x3C && data[i+1] === 0x68 && data[i+2] === 0x74 && data[i+3] === 0x6D && data[i+4] === 0x6C) {
          htmlStarts.push(i)
        }
      }
      if (htmlStarts.length > 0) {
        const parts: string[] = []
        for (const start of htmlStarts) {
          const end = findBytes(data, '</html>', start)
          if (end >= 0) {
            parts.push(decodeTextSegment(data, start, end + 7 - start))
          } else {
            parts.push(decodeTextSegment(data, start, Math.min(500000, data.length - start)))
          }
        }
        text = parts.join('\n')
      }
      if (!text) {
        // Try raw text extraction after skipping ITSF header
        const skip = getU32(data, 8)
        text = decodeTextBest(data.slice(skip))
      }
    }
  } catch { /* fall through */ }

  if (!text || text.length < 50) {
    // Last resort: search for HTML tags in raw bytes
    text = decodeTextBest(data)
  }

  const cleaned = sanitizeEpubContent(text)
  const chapters = splitHtmlChapters(cleaned, title)
  const wordCount = chapters.reduce((s, c) => s + countWords(c.content), 0)

  return {
    metadata: { title, author: '未知作者', cover: '', format: 'chm' },
    chapters: chapters.length > 0 ? chapters : [{ title, content: cleaned || '<p>无法解析 CHM 文本内容，文件已保留。</p>' }],
    rawToc: chapters.map((c, i) => ({ label: c.title, href: '', chapterIndex: i })),
    rawContent: text.slice(0, 10000)
  }
}

// ========== LIT (Microsoft Reader) ==========

async function parseLit(fileData: ArrayBuffer, fileName: string): Promise<ParsedBook> {
  const data = new Uint8Array(fileData)
  const title = fileName.replace(/\.lit$/i, '')
  let text = ''
  let author = '未知作者'

  try {
    // LIT files are OLE2 compound documents containing HTML content
    // Search for HTML content blocks within the binary
    const htmlStarts: number[] = []
    for (let i = 0; i < data.length - 6; i++) {
      if (data[i] === 0x3C && data[i+1] === 0x68 && data[i+2] === 0x74 && data[i+3] === 0x6D && data[i+4] === 0x6C) {
        htmlStarts.push(i)
      }
    }

    if (htmlStarts.length > 0) {
      const parts: string[] = []
      for (const start of htmlStarts) {
        const end = findBytes(data, '</html>', start)
        if (end >= 0) {
          parts.push(decodeTextSegment(data, start, end + 7 - start))
        } else {
          // Try </body> as fallback
          const bodyEnd = findBytes(data, '</body>', start)
          if (bodyEnd >= 0) {
            parts.push(decodeTextSegment(data, start, bodyEnd + 7 - start))
          } else {
            parts.push(decodeTextSegment(data, start, Math.min(500000, data.length - start)))
          }
        }
      }
      text = parts.join('\n')
    }

    if (!text) {
      // Try decoding as plain text after skipping headers
      text = decodeTextBest(data.slice(100))
    }

    // Try to find author from metadata
    const authorMatch = text.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']*)["']/i)
      || text.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']author["']/i)
      || text.match(/Author[：:]\s*(.+)/i)
    if (authorMatch) author = authorMatch[1].trim()
  } catch { /* fall through */ }

  if (!text || text.length < 50) {
    text = decodeTextBest(data)
  }

  const cleaned = sanitizeEpubContent(text)
  const chapters = splitHtmlChapters(cleaned, title)
  const wordCount = chapters.reduce((s, c) => s + countWords(c.content), 0)

  return {
    metadata: { title, author, cover: '', format: 'lit' },
    chapters: chapters.length > 0 ? chapters : [{ title, content: cleaned || '<p>无法解析 LIT 文本内容，文件已保留。</p>' }],
    rawToc: chapters.map((c, i) => ({ label: c.title, href: '', chapterIndex: i })),
    rawContent: text.slice(0, 10000)
  }
}

// ========== LRF (Sony BBeB) ==========

async function parseLrf(fileData: ArrayBuffer, fileName: string): Promise<ParsedBook> {
  const data = new Uint8Array(fileData)
  let title = fileName.replace(/\.lrf$/i, '')
  let author = '未知作者'
  let text = ''

  try {
    const raw = decodeTextBest(data)
    if (raw.length > 0) {
      // LRF/BBeB is XML-based. Extract from XML tags.
      // Try to find title and author
      const titleMatch = raw.match(/<dc:title[^>]*>([^<]*)<\/dc:title>/i)
        || raw.match(/<title[^>]*>([^<]*)<\/title>/i)
      if (titleMatch) { title = titleMatch[1].trim() }

      const authorMatch = raw.match(/<dc:creator[^>]*>([^<]*)<\/dc:creator>/i)
        || raw.match(/<creator[^>]*>([^<]*)<\/creator>/i)
        || raw.match(/Author[：:]\s*(.+)/i)
      if (authorMatch) author = authorMatch[1].trim()

      // Extract text content from XML tags
      // Remove XML declaration and processing instructions
      const content = raw.replace(/<\?[^>]*\?>/g, '')
        .replace(/<dc:[^>]*\/>/g, '')
        .replace(/<metadata[^>]*>[\s\S]*?<\/metadata>/gi, '')

      // Wrap text blocks in <p> tags
      const textBlocks = content.match(/<TextBlock[^>]*>([\s\S]*?)<\/TextBlock>/gi)
      if (textBlocks && textBlocks.length > 0) {
        text = textBlocks.map(b => b.replace(/<TextBlock[^>]*>|<\/TextBlock>/gi, '').trim())
          .filter(Boolean)
          .map(t => `<p>${t.replace(/<[^>]+>/g, (m) => escapeHtml(m))}</p>`)
          .join('\n')
      }

      if (!text) {
        // Fallback: strip all XML tags and keep text content
        const stripped = content.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, '\n').trim()
        if (stripped.length > 50) {
          text = stripped.split('\n').map(l => l.trim()).filter(Boolean).map(l => `<p>${escapeHtml(l)}</p>`).join('\n')
        }
      }

      if (!text) {
        text = raw.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, '\n').trim()
        if (text.length > 50) {
          text = `<p>${escapeHtml(text)}</p>`
        }
      }
    }
  } catch { /* fall through */ }

  if (!text || text.length < 50) {
    text = decodeTextBest(data)
  }

  const cleaned = sanitizeEpubContent(text)
  const chapters = splitHtmlChapters(cleaned, title)
  const wordCount = chapters.reduce((s, c) => s + countWords(c.content), 0)

  return {
    metadata: { title, author, cover: '', format: 'lrf' },
    chapters: chapters.length > 0 ? chapters : [{ title, content: cleaned || '<p>无法解析 LRF 文本内容，文件已保留。</p>' }],
    rawToc: chapters.map((c, i) => ({ label: c.title, href: '', chapterIndex: i })),
    rawContent: text.slice(0, 10000)
  }
}

// ========== Comic ==========

async function parseComic(fileData: ArrayBuffer, fileName: string, format: 'cbr' | 'cbz' | 'cbt' | 'cb7'): Promise<ParsedBook> {
  const title = fileName.replace(new RegExp(`\\.${format}$`, 'i'), '')

  // CBR/CB7 — 浏览器环境无法原生解析这些压缩格式，返回明确说明
  if (format === 'cbr' || format === 'cb7') {
    const formatLabel: Record<string, string> = { cbr: 'CBR (RAR)', cb7: 'CB7 (7z)' }
    const formatNotice: Record<string, string> = {
      cbr: 'CBR 使用 RAR 专有压缩格式。RAR 为闭源格式，无法在浏览器端直接解压。请将文件转换为 CBZ（ZIP）格式后重新导入：\n1. 将 .cbr 改名为 .rar，用解压软件解压\n2. 将解压出的图片打包为 .zip 文件\n3. 将 .zip 改名为 .cbz 即可',
      cb7: 'CB7 使用 7z 压缩格式。7z 格式复杂度较高，浏览器端缺少可用的解析库。请将文件转换为 CBZ（ZIP）格式后重新导入：\n1. 用解压软件解压 .cb7 文件\n2. 将解压出的图片打包为 .zip 文件\n3. 将 .zip 改名为 .cbz 即可'
    }
    const notice = formatNotice[format] || '不支持的漫画格式。'
    const chapters: ChapterContent[] = [{
      title: '格式说明',
      content: `<div class="comic-format-notice"><h3>暂不支持 ${formatLabel[format] || format.toUpperCase()} 格式</h3><p>${notice.replace(/\n/g, '<br>')}</p></div>`
    }]
    return {
      metadata: { title, author: '未知作者', cover: '', format },
      chapters,
      rawToc: [{ label: '格式说明', href: '', chapterIndex: 0 }]
    }
  }

  // ==== CBT (TAR) handling ====
  if (format === 'cbt') {
    return parseTarComic(fileData, title)
  }

  // ==== CBZ (ZIP) handling ====

  let zip: any = null
  let imagePaths: string[] = []

  try {
    const JSZip = (await import('jszip')).default
    zip = await JSZip.loadAsync(fileData)

    // Filter image files and sort by natural order
    const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
    imagePaths = Object.keys(zip.files)
      .filter(n => {
        const ext = (n.split('.').pop() || '').toLowerCase()
        return imgExts.includes(ext)
      })
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  } catch (e) {
    logger.error(`CBZ 解析失败: ${fileName}`, e)
  }

  if (imagePaths.length === 0) {
    const chapters: ChapterContent[] = [{
      title: '格式说明',
      content: `<div class="comic-format-notice"><h3>CBZ 文件解析失败</h3><p>文件可能已损坏、格式不正确，或不包含支持的图片格式（JPG、PNG、GIF、WebP、BMP）。</p></div>`
    }]
    return {
      metadata: { title, author: '未知作者', cover: '', format },
      chapters,
      rawToc: [{ label: '格式说明', href: '', chapterIndex: 0 }]
    }
  }

  // Limit to MAX_COMIC_IMAGES to prevent memory overflow
  // Images are stored as inline base64 data URIs in chapter content.
  // Each 5MB image becomes ~6.7MB base64, so 50 images = ~335MB max.
  // TODO: Future optimization — store images as files in userData and reference by URL
  const MAX_COMIC_IMAGES = 50
  const MAX_COMIC_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB raw, skip larger images
  const totalImageCount = imagePaths.length
  const truncated = totalImageCount > MAX_COMIC_IMAGES
  const pathsToLoad = truncated ? imagePaths.slice(0, MAX_COMIC_IMAGES) : imagePaths

  // MIME type map
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp'
  }

  // Read each image from zip, convert to base64 data URI, and create chapters
  const chapters: ChapterContent[] = []
  for (let i = 0; i < pathsToLoad.length; i++) {
    const imgPath = pathsToLoad[i]
    const imgFile = zip.file(imgPath)
    if (!imgFile) {
      chapters.push({
        title: `第 ${i + 1} 页`,
        content: `<div class="comic-page"><p class="comic-page-num">第 ${i + 1} 页 / 共 ${pathsToLoad.length} 页</p><p style="color:#999">图片未找到</p></div>`
      })
      continue
    }

    try {
      const data: ArrayBuffer = await imgFile.async('arraybuffer')
      // Skip oversized images to prevent memory blow-up from base64 encoding
      if (data.byteLength > MAX_COMIC_IMAGE_SIZE) {
        chapters.push({
          title: `第 ${i + 1} 页`,
          content: `<div class="comic-page"><p class="comic-page-num">第 ${i + 1} 页 / 共 ${pathsToLoad.length} 页</p><p style="color:#999">图片过大 (${(data.byteLength / 1024 / 1024).toFixed(1)}MB)，已跳过</p></div>`
        })
        continue
      }
      const ext = (imgPath.split('.').pop() || 'jpg').toLowerCase()
      const mime = mimeMap[ext] || 'image/jpeg'
      const dataUri = dataUrl(data, mime)
      chapters.push({
        title: `第 ${i + 1} 页`,
        content: `<div class="comic-page"><img src="${dataUri}" alt="第 ${i + 1} 页" /></div>`
      })
    } catch (e) {
      logger.error(`CBZ 图片提取失败: ${imgPath}`, e)
      chapters.push({
        title: `第 ${i + 1} 页`,
        content: `<div class="comic-page"><p class="comic-page-num">第 ${i + 1} 页 / 共 ${pathsToLoad.length} 页</p><p style="color:#999">图片加载失败</p></div>`
      })
    }
  }

  // Append truncation notice if needed
  if (truncated) {
    chapters.push({
      title: '⚠️ 截断提示',
      content: `<div class="comic-truncation-notice"><p>⚠️ 本书包含 ${totalImageCount} 张图片，数量超过 ${MAX_COMIC_IMAGES} 张限制。仅显示前 ${MAX_COMIC_IMAGES} 张，剩余 ${totalImageCount - MAX_COMIC_IMAGES} 张未加载。</p></div>`
    })
  }

  return {
    metadata: { title, author: '未知作者', cover: '', format },
    chapters,
    rawToc: chapters.map((c, i) => ({ label: c.title, href: '', chapterIndex: i }))
  }
}

// ========== TAR (CBT) parsing ==========

/** Parse a TAR archive and extract comic page images */
function parseTarComic(fileData: ArrayBuffer, title: string): ParsedBook {
  const data = new Uint8Array(fileData)
  const MAX_COMIC_IMAGES = 200
  const MAX_COMIC_IMAGE_SIZE = 10 * 1024 * 1024
  const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp'
  }

  const imageEntries: { name: string; data: Uint8Array }[] = []
  let offset = 0

  try {
    while (offset + 512 <= data.length && imageEntries.length < MAX_COMIC_IMAGES) {
      // Check for end-of-archive (two consecutive zero blocks)
      if (isZeroBlock(data, offset, 512)) {
        break
      }

      // Read filename (offset 0-99, null-terminated)
      const filename = readCString(data, offset, 100)

      // Read file size (offset 124-135, octal string)
      const sizeStr = readCString(data, offset + 124, 12)
      const fileSize = parseInt(sizeStr, 8)
      if (isNaN(fileSize) || fileSize <= 0) {
        offset += 512
        continue
      }

      // Skip directories and long filenames
      const typeflag = String.fromCharCode(data[offset + 156])
      if (typeflag === '5' || typeflag === 'L' || typeflag === 'K') {
        offset += 512
        continue
      }

      // Filter by image extension
      const ext = (filename.split('.').pop() || '').toLowerCase()
      if (imgExts.includes(ext)) {
        if (fileSize > MAX_COMIC_IMAGE_SIZE) {
          offset += 512 + Math.ceil(fileSize / 512) * 512
          continue
        }
        const dataStart = offset + 512
        const dataEnd = Math.min(dataStart + fileSize, data.length)
        if (dataStart <= data.length) {
          imageEntries.push({
            name: filename,
            data: data.slice(dataStart, dataEnd)
          })
        }
      }

      // Advance to next header (512-aligned)
      offset += 512 + Math.ceil(fileSize / 512) * 512
    }
  } catch {
    // TAR parsing error — will fall through to error case below
  }

  // Sort naturally
  imageEntries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))

  if (imageEntries.length === 0) {
    return {
      metadata: { title, author: '未知作者', cover: '', format: 'cbt' },
      chapters: [{
        title: '格式说明',
        content: `<div class="comic-format-notice"><h3>CBT 文件解析失败</h3><p>文件可能已损坏、格式不正确，或不包含支持的图片格式（JPG、PNG、GIF、WebP、BMP）。</p></div>`
      }],
      rawToc: [{ label: '格式说明', href: '', chapterIndex: 0 }]
    }
  }

  const totalImageCount = imageEntries.length
  const truncated = totalImageCount > MAX_COMIC_IMAGES
  const entriesToLoad = truncated ? imageEntries.slice(0, MAX_COMIC_IMAGES) : imageEntries

  const chapters: ChapterContent[] = []
  for (let i = 0; i < entriesToLoad.length; i++) {
    const entry = entriesToLoad[i]
    const ext = (entry.name.split('.').pop() || 'jpg').toLowerCase()
    const mime = mimeMap[ext] || 'image/jpeg'
    const dataUri = dataUrl(entry.data.buffer, mime)
    chapters.push({
      title: `第 ${i + 1} 页`,
      content: `<div class="comic-page"><img src="${dataUri}" alt="第 ${i + 1} 页" /></div>`
    })
  }

  if (truncated) {
    chapters.push({
      title: '⚠️ 截断提示',
      content: `<div class="comic-truncation-notice"><p>⚠️ 本书包含 ${totalImageCount} 张图片，数量超过 ${MAX_COMIC_IMAGES} 张限制。仅显示前 ${MAX_COMIC_IMAGES} 张，剩余 ${totalImageCount - MAX_COMIC_IMAGES} 张未加载。</p></div>`
    })
  }

  return {
    metadata: { title, author: '未知作者', cover: '', format: 'cbt' },
    chapters,
    rawToc: chapters.map((c, i) => ({ label: c.title, href: '', chapterIndex: i }))
  }
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

// ========== Path normalization ==========

/** Normalize a path string by resolving `.` and `..` segments in-place. */
function normalizePath(p: string): string {
  const parts = p.split('/').filter(s => s !== '' && s !== '.')
  const result: string[] = []
  for (const part of parts) {
    if (part === '..') {
      // Go up one level — but never escape above root
      if (result.length > 0) result.pop()
    } else {
      result.push(part)
    }
  }
  return result.join('/')
}

function resolvePath(base: string, rel: string): string {
  const combined = rel.startsWith('/') ? base + rel.slice(1) : base + rel
  return normalizePath(combined)
}

/** Normalize an EPUB text reference (from NCX content src or manifest href) for matching */
function normalizeTextRef(base: string, href: string): string {
  return normalizePath(base + href.split('#')[0].replace(/^\//, ''))
}

// ========== MIME maps ==========

const IMAGE_MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', jpe: 'image/jpeg',
  png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  bmp: 'image/bmp', svg: 'image/svg+xml', svgz: 'image/svg+xml',
  tif: 'image/tiff', tiff: 'image/tiff',
  ico: 'image/x-icon', avif: 'image/avif',
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function embedImages(html: string, chapterDir: string, rootDir: string, zip: any): Promise<string> {
  const replacements: { from: string; to: string }[] = []

  // ---- Helper to resolve & embed a single image reference ----
  const embedOne = async (src: string): Promise<string> => {
    // Skip external URLs and already embedded data URIs
    if (/^(data:|https?:\/\/)/i.test(src)) return src

    // Resolve image path relative to chapter file directory
    const imgPath = src.startsWith('/')
      ? resolvePath(rootDir, src)
      : resolvePath(chapterDir, src)

    const imgFile = zip.file(imgPath)
    if (!imgFile) return '' // not found

    try {
      const data = await imgFile.async('arraybuffer')
      const MAX_IMG = 2 * 1024 * 1024
      if (data.byteLength > MAX_IMG) return src
      const ext = (imgPath.split('.').pop() || 'jpg').toLowerCase()
      const mime = IMAGE_MIME_MAP[ext] || 'image/jpeg'
      return dataUrl(data, mime)
    } catch {
      return '' // read error
    }
  }

  // ---- 1) <img src="..."> tags ----
  const imgRegex = /(<img\b[^>]*\bsrc\s*=\s*)(["'])([^"']+)\2([^>]*>)/gi
  let match: RegExpExecArray | null
  while ((match = imgRegex.exec(html)) !== null) {
    const fullMatch = match[0]
    const src = match[3]
    const dataUri = await embedOne(src)

    if (dataUri) {
      replacements.push({ from: fullMatch, to: fullMatch.replace(src, dataUri) })
    } else {
      replacements.push({
        from: fullMatch,
        to: fullMatch.replace(new RegExp(`\\bsrc\\s*=\\s*["']${escapeRegex(src)}["']`, 'i'), 'src=""')
      })
    }
  }

  // ---- 2) Inline <svg> elements that contain <image href="..."> or <image xlink:href="..."> ----
  // SVG <image> elements can reference external raster/vector images inside an inline SVG.
  // We resolve them to data URIs so the entire SVG block is self-contained.
  const svgImageRegex = /(<image\b[^>]*?\b(?:xlink:)?href\s*=\s*)(["'])([^"']+)\2([^>]*\/?>)/gi
  while ((match = svgImageRegex.exec(html)) !== null) {
    const fullMatch = match[0]
    const href = match[3]

    // Only process relative paths (skip data: and http:)
    if (/^(data:|https?:\/\/)/i.test(href)) continue

    const dataUri = await embedOne(href)
    if (dataUri) {
      replacements.push({ from: fullMatch, to: fullMatch.replace(href, dataUri) })
    }
    // If not found, leave as-is — the browser will show a broken image placeholder
  }

  // ---- 3) CSS background-image: url(...) ----
  // NOTE: Extracting and inlining background-image references from <style> tags and inline
  // `style` attributes is complex due to the variety of quoting patterns, nested url()
  // functions, and potential data URIs already present. This is intentionally left as a
  // future enhancement. For now, background images that reference external EPUB resources
  // will not render — we rely on <img> tags (which covers the majority of illustrated EPUBs).
  // If needed in the future, we could:
  //   a) Parse <style> block content for `url("...")` / `url('...')` / `url(...)` patterns
  //   b) Walk all elements via regex, extract their `style` attribute, and resolve url() refs
  //   c) Replace each resolved ref with a data URI inline

  // ---- Apply all replacements ----
  for (const { from, to } of replacements) {
    html = html.replace(from, to)
  }

  return html
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

function dataUrl(buf: ArrayBuffer, mime: string): string {
  return `data:${mime};base64,${arrayBufferToBase64(buf)}`
}

function base64ToBytes(b64: string): Uint8Array {
  const b = atob(b64); const r = new Uint8Array(b.length)
  for (let i=0; i<b.length; i++) r[i] = b.charCodeAt(i)
  return r
}

function decodeTextSegment(d: Uint8Array, off: number, len: number): string {
  const effectiveLen = Math.min(len, d.length - off)
  if (effectiveLen <= 0) return ''

  // Trim trailing null bytes (common in binary document formats)
  let end = off + effectiveLen
  while (end > off && d[end - 1] === 0) end--
  if (end <= off) return ''

  const segment = d.slice(off, end)

  // Try UTF-8 first (most common encoding for modern MOBI files)
  const utf8 = new TextDecoder('utf-8', { fatal: false })
  let text = utf8.decode(segment)
  let repl = (text.match(/\ufffd/g) || []).length

  // If UTF-8 has too many replacement chars, try GB18030 (covers GBK/GB2312)
  if (repl > 0) {
    try {
      const gb = new TextDecoder('gb18030', { fatal: false })
      const gbText = gb.decode(segment)
      const gbRepl = (gbText.match(/\ufffd/g) || []).length
      if (gbRepl < repl) { text = gbText; repl = gbRepl }
    } catch { /* gb18030 not supported */ }
  }

  // Fallback: if still garbled (>30% replacement chars), decode byte-by-byte as ASCII/Latin-1
  if (repl > segment.length * 0.3) {
    let r = ''
    for (let i = 0; i < segment.length && segment[i] !== 0; i++) {
      r += String.fromCharCode(segment[i])
    }
    text = r
  }

  return text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').trim()
}

function getU32(d: Uint8Array, off: number): number {
  return off+4 <= d.length ? (d[off]<<24)|(d[off+1]<<16)|(d[off+2]<<8)|d[off+3] : 0
}

function getU24BE(d: Uint8Array, off: number): number {
  return off+3 <= d.length ? (d[off]<<16)|(d[off+1]<<8)|d[off+2] : 0
}

async function decompressZlib(chunk: Uint8Array): Promise<Uint8Array> {
  // DJVU TXTz chunks use raw DEFLATE (RFC 1951) without zlib header.
  // Use the browser's built-in DecompressionStream for proper decompression.
  try {
    const ds = new DecompressionStream('deflate-raw')
    const writer = ds.writable.getWriter()
    const reader = ds.readable.getReader()
    writer.write(chunk)
    writer.close()
    const parts: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      parts.push(value)
    }
    // Concatenate all parts into a single Uint8Array
    const totalLen = parts.reduce((s, p) => s + p.length, 0)
    const result = new Uint8Array(totalLen)
    let offset = 0
    for (const p of parts) { result.set(p, offset); offset += p.length }
    return result
  } catch {
    // If decompression fails, return empty — caller handles gracefully
    return new Uint8Array(0)
  }
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

/** Check if a range of a Uint8Array is all zeros */
function isZeroBlock(data: Uint8Array, offset: number, length: number): boolean {
  if (offset + length > data.length) return false
  for (let i = offset; i < offset + length; i++) {
    if (data[i] !== 0) return false
  }
  return true
}

/** Read a null-terminated C string from a Uint8Array */
function readCString(data: Uint8Array, offset: number, maxLen: number): string {
  const end = Math.min(offset + maxLen, data.length)
  let strEnd = offset
  while (strEnd < end && data[strEnd] !== 0) strEnd++
  let result = ''
  for (let i = offset; i < strEnd; i++) {
    result += String.fromCharCode(data[i])
  }
  return result.trim()
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
  onProgress?: (message: string) => void,
  timeoutMs: number = 30000
): Promise<ParsedBook> {
  return new Promise((resolve, reject) => {
    const tid = setTimeout(() => reject(new Error(`解析超时: ${fileName}`)), timeoutMs)
    worker.onmessage = (e: MessageEvent) => {
      clearTimeout(tid)
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
      clearTimeout(tid)
      reject(new Error(e.message || 'Worker error'))
    }
    worker.postMessage({ filePath, fileName, fileData, fileSize }, [fileData])
  })
}
