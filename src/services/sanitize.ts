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

// Strip url() from inline styles to prevent CSS data exfiltration
function stripStyleUrls(html: string): string {
  return html
    .replace(/style\s*=\s*"[^"]*url\([^)]*\)[^"]*"/gi, (m: string) => m.replace(/url\([^)]*\)/gi, 'none'))
    .replace(/style\s*=\s*'[^']*url\([^)]*\)[^']*'/gi, (m: string) => m.replace(/url\([^)]*\)/gi, 'none'))
    .replace(/style\s*=\s*[^"' >]+/gi, (m: string) => {
      if (/url\(/i.test(m)) return m.replace(/url\([^)]*\)/gi, 'none')
      return m
    })
}

/**
 * Sanitize HTML content using DOMPurify with a strict whitelist.
 * Falls back to complete HTML stripping if DOMPurify is unavailable.
 */
export async function sanitizeHtml(dirty: string): Promise<string> {
  const DOMPurify = await getDOMPurify()
  if (!DOMPurify || typeof document === 'undefined') {
    // DOMPurify failed to load — strip ALL HTML tags for safety
    return stripStyleUrls(dirty.replace(/<[^>]*>/g, ''))
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
      'width', 'height', 'style',
      'start', 'type', 'colspan', 'rowspan'
    ],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|app):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i
  })

  return stripStyleUrls(clean)
}

/**
 * Pre-clean for EPUB content before DOMPurify processing.
 * WARNING: This regex-based sanitizer is NOT sufficient as standalone XSS protection.
 * It only handles obvious script/javascript patterns. The primary sanitizer is
 * DOMPurify (called from ReaderView's sanitizedContent computed). This function
 * exists as a defense-in-depth measure for patterns that DOMPurify might miss
 * in edge cases (e.g., obfuscated payloads in malformed EPUBs).
 * See also: sanitizeHtml() which is the full DOMPurify pipeline.
 */
export function sanitizeEpubContent(dirty: string): string {
  return dirty
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/javascript\s*:/gi, 'blocked:')
}

/**
 * Strip ALL HTML tags. Used only when DOMPurify fails to load.
 */
function sanitizeTextOnly(dirty: string): string {
  return dirty.replace(/<[^>]*>/g, '').replace(/javascript\s*:/gi, 'blocked:')
}
