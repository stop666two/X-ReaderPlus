import DOMPurify from 'dompurify'

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'b', 'i', 'em', 'strong', 'u', 's', 'mark', 'small', 'sub', 'sup',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'a', 'img', 'span', 'div',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'figure', 'figcaption'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'id',
      'width', 'height', 'style', 'data-*',
      'start', 'type', 'colspan', 'rowspan'
    ],
    ALLOW_DATA_ATTR: true,
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|app):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i
  })
}

export function sanitizeEpubContent(dirty: string): string {
  let cleaned = dirty
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '')
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, '')
  cleaned = cleaned.replace(/<svg[\s\S]*?<\/svg>/gi, '')
  cleaned = cleaned.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
  cleaned = cleaned.replace(/\son\w+\s*=\s*[^\s>]*/gi, '')

  return sanitizeHtml(cleaned)
}
