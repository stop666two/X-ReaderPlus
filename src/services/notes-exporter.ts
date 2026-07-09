import type { Annotation, Bookmark } from '@/types'

interface ExportOptions {
  format: 'csv' | 'markdown' | 'json'
  type: 'all' | 'highlights' | 'notes' | 'bookmarks'
  bookId?: string
}

function stripHtml(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

function escapeMarkdown(s: string): string {
  return s.replace(/([_*`#\[\]()])/g, '\\$1')
}

function annotationToMarkdown(a: Annotation, bookTitle: string, chapterTitle?: string): string {
  const lines: string[] = []
  lines.push(`> ${stripHtml(a.text || '')}`)
  if (a.note) lines.push(`\n**笔记**: ${escapeMarkdown(a.note)}`)
  lines.push(`\n*— 来自《${bookTitle}》${chapterTitle ? '· ' + chapterTitle : ''}*\n`)
  return lines.join('\n')
}

function annotationToCsvRow(a: Annotation, bookTitle: string, chapterTitle?: string): string {
  const escape = (s: string) => `"${(s || '').replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, ' ')}"`
  return [a.id, escape(bookTitle), escape(chapterTitle || ''), escape(a.type), escape(stripHtml(a.text || '')), escape(a.note || ''), a.color || '', new Date(a.createdAt || Date.now()).toISOString()].join(',')
}

function bookmarkToMarkdown(b: Bookmark, bookTitle: string): string {
  return `- 📑 ${b.name || '书签'} — 来自《${bookTitle}》\n`
}

export function exportAnnotations(
  annotations: Annotation[],
  bookmarks: Bookmark[],
  getBookTitle: (id: string) => string,
  options: ExportOptions & { getChapterTitle?: (bookId: string, chapterIndex: number) => string }
): string {
  const resolveChapter = (a: Annotation) => options.getChapterTitle ? options.getChapterTitle(a.bookId, a.chapterIndex) : ''
  switch (options.format) {
    case 'csv':
      return exportCsv(annotations, bookmarks, getBookTitle, resolveChapter, options)
    case 'markdown':
      return exportMarkdown(annotations, bookmarks, getBookTitle, resolveChapter, options)
    case 'json':
    default:
      return exportJson(annotations, bookmarks, getBookTitle, options)
  }
}

function exportCsv(
  annotations: Annotation[],
  _bookmarks: Bookmark[],
  getBookTitle: (id: string) => string,
  getChapterTitle: (a: Annotation) => string,
  options: ExportOptions
): string {
  const lines = ['id,book,chapter,type,text,note,color,createdAt']
  if (options.type === 'all' || options.type === 'highlights' || options.type === 'notes') {
    for (const a of filterAnnotations(annotations, options)) {
      lines.push(annotationToCsvRow(a, getBookTitle(a.bookId), getChapterTitle(a)))
    }
  }
  return lines.join('\n')
}

function exportMarkdown(
  annotations: Annotation[],
  bookmarks: Bookmark[],
  getBookTitle: (id: string) => string,
  getChapterTitle: (a: Annotation) => string,
  options: ExportOptions
): string {
  const lines: string[] = ['# 读书笔记与标注', '', `导出时间: ${new Date().toLocaleString()}`, '', '---', '']
  if (options.type === 'all' || options.type === 'highlights') {
    lines.push('## 标注与高亮', '')
    for (const a of filterAnnotations(annotations, options)) {
      lines.push(annotationToMarkdown(a, getBookTitle(a.bookId), getChapterTitle(a)))
    }
  }
  if (options.type === 'all' || options.type === 'notes') {
    const withNotes = annotations.filter(a => a.note)
    if (withNotes.length > 0) {
      lines.push('## 读书笔记', '')
      for (const a of withNotes) {
        lines.push(annotationToMarkdown(a, getBookTitle(a.bookId), getChapterTitle(a)))
      }
    }
  }
  if (options.type === 'all' || options.type === 'bookmarks') {
    lines.push('## 书签', '')
    const grouped = new Map<string, Bookmark[]>()
    for (const b of bookmarks) {
      const list = grouped.get(b.bookId) || []
      list.push(b)
      grouped.set(b.bookId, list)
    }
    for (const [, bms] of grouped) {
      for (const b of bms) {
        lines.push(bookmarkToMarkdown(b, getBookTitle(b.bookId)))
      }
    }
  }
  return lines.join('\n')
}

function exportJson(
  annotations: Annotation[],
  bookmarks: Bookmark[],
  getBookTitle: (id: string) => string,
  options: ExportOptions
): string {
  const data: Record<string, any[]> = {}
  if (options.type === 'all' || options.type === 'highlights' || options.type === 'notes') {
    data.annotations = filterAnnotations(annotations, options).map(a => ({
      ...a,
      bookTitle: getBookTitle(a.bookId)
    }))
  }
  if (options.type === 'all' || options.type === 'bookmarks') {
    data.bookmarks = bookmarks.map(b => ({
      ...b,
      bookTitle: getBookTitle(b.bookId)
    }))
  }
  return JSON.stringify(data, null, 2)
}

function filterAnnotations(annotations: Annotation[], options: ExportOptions): Annotation[] {
  let filtered = [...annotations]
  if (options.bookId) filtered = filtered.filter(a => a.bookId === options.bookId)
  if (options.type === 'highlights') filtered = filtered.filter(a => a.type === 'highlight')
  if (options.type === 'notes') filtered = filtered.filter(a => a.note)
  return filtered
}

export function downloadExport(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
