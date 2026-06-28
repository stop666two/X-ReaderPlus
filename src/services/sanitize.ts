let _DOMPurify: any = null

async function getDOMPurify() {
  if (_DOMPurify) return _DOMPurify
  try {
    const mod = await import('dompurify')
    _DOMPurify = mod.default || mod
  } catch {
    _DOMPurify = null
  }
  return _DOMPurify
}

export async function sanitizeHtml(dirty: string): Promise<string> {
  const DOMPurify = await getDOMPurify()
  if (!DOMPurify || typeof document === 'undefined') {
    return sanitizeTextOnly(dirty)
  }
  const clean = DOMPurify.sanitize(dirty, {
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

  return clean.replace(/style="[^"]*url\([^)]*\)[^"]*"/gi, (match: string) => {
    return match.replace(/url\([^)]*\)/gi, 'none')
  })
}

export function sanitizeEpubContent(dirty: string): string {
  let cleaned = dirty
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '')
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, '')
  cleaned = cleaned.replace(/<svg[\s\S]*?<\/svg>/gi, '')
  cleaned = cleaned.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
  cleaned = cleaned.replace(/\son\w+\s*=\s*[^\s>]*/gi, '')

  return sanitizeTextOnly(cleaned)
}

function sanitizeTextOnly(dirty: string): string {
  return dirty
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>/gi, '')
    .replace(/<link[\s\S]*?>/gi, '')
    .replace(/<meta[\s\S]*?>/gi, '')
    .replace(/<base[\s\S]*?>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/javascript\s*:/gi, 'blocked:')
    .replace(/<style="[^"]*url\([^)]*\)[^"]*"/gi, (m: string) => m.replace(/url\([^)]*\)/gi, 'none'))
}
