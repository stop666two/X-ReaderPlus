import type { ReadingSettings, HighlightColor, BookFormat, ThemeColors, AppSettings, CustomThemes } from '@/types'

export const APP_NAME = 'X-ReaderPlus'
export const APP_VERSION = '0.4.1'
export const DB_VERSION = 6
export const MAX_FILE_SIZE = 500 * 1024 * 1024
export const MAX_EPUB_FILES = 10000
export const MAX_READER_WIDTH = 900
export const DEFAULT_LIBRARY_ID = 'default'
export const DEFAULT_LIBRARY_NAME = '默认书库'

export const DEFAULT_READING_SETTINGS: ReadingSettings = {
  fontSize: 18,
  lineHeight: 1.8,
  paragraphSpacing: 16,
  textIndent: 2,
  fontWeight: 400,
  fontFamily: 'system-ui, -apple-system, "Segoe UI", "Noto Sans SC", sans-serif',
  marginHorizontal: 16,
  pageWidth: 800,
  textAlign: 'justify',
  showChapterTitle: true,
  hyphenation: false,
  fontSizeScale: 0,
  bgImageUrl: '',
  bgOpacity: 0.85,
  customCSS: '',
  showReadingStats: true,
  autoSaveInterval: 10,
  letterSpacing: 0,
  wordSpacing: 0,
  firstLineIndent: true,
  verticalText: false,
  columnCount: 1,
  readingWidth: 'medium',
  pageAnimation: 'none',
  hideScrollbar: false,
  dimBackground: false,
  lineFocus: false,
  sepiaIntensity: 100,
  brightness: 100,
  contrast: 100
}

export const DEFAULT_THEME_COLORS: ThemeColors = {
  primary: '#1976D2',
  secondary: '#424242',
  accent: '#82B1FF',
  bgColor: '#FFFFFF',
  textColor: '#212121'
}

export const DEFAULT_CUSTOM_THEMES: CustomThemes = {
  light: {
    primary: '#1565C0',
    surface: '#FFFFFF',
    background: '#F5F5F5',
    textColor: '#212121'
  },
  dark: {
    primary: '#90CAF9',
    surface: '#1E1E1E',
    background: '#121212',
    textColor: '#E0E0E0'
  },
  sepia: {
    primary: '#6D4C41',
    surface: '#FDF6E3',
    background: '#F4ECD8',
    textColor: '#3E2723'
  }
}

export const DEFAULT_TOOLBAR_AUTO_HIDE_DELAY = 4
export const DEFAULT_AUTO_SCROLL_SPEED = 50

export const DEFAULT_READING_SHORTCUTS = {
  scrollUp: 'ArrowUp',
  scrollDown: 'ArrowDown',
  pageUp: 'PageUp',
  pageDown: 'Space',
  prevChapter: 'ArrowLeft',
  nextChapter: 'ArrowRight',
  search: 'Ctrl+F',
  chapterStart: 'Home',
  chapterEnd: 'End'
}
export const PIN_MAX_ATTEMPTS = 5
export const PIN_LOCK_DURATION = 30000
export const DEFAULT_PIN_ESCALATION = {
  firstAttempts: 5,
  firstLockDuration: 30,
  secondAttempts: 10,
  secondLockDuration: 300
}
export const PIN_PBKDF2_ITERATIONS = 600000

export const HIGHLIGHT_COLORS: { value: HighlightColor; label: string; hex: string; bg: string }[] = [
  { value: 'yellow', label: '黄色', hex: '#F9A825', bg: 'rgba(249,168,37,0.35)' },
  { value: 'green', label: '绿色', hex: '#2E7D32', bg: 'rgba(46,125,50,0.35)' },
  { value: 'blue', label: '蓝色', hex: '#1565C0', bg: 'rgba(21,101,192,0.35)' },
  { value: 'pink', label: '粉色', hex: '#C62828', bg: 'rgba(198,40,40,0.35)' },
  { value: 'orange', label: '橙色', hex: '#EF6C00', bg: 'rgba(239,108,0,0.35)' },
  { value: 'purple', label: '紫色', hex: '#6A1B9A', bg: 'rgba(106,27,154,0.35)' }
]

export const ALLOWED_FORMATS = new Set<BookFormat>([
  'epub', 'pdf', 'txt', 'fb2', 'djvu', 'chm', 'lit', 'lrf',
  'docx', 'rtf', 'odt', 'markdown', 'html',
  'cbz', 'cbt'
])

export const SUPPORTED_FORMATS: { value: BookFormat; label: string; extensions: string[] }[] = [
  { value: 'epub', label: 'EPUB', extensions: ['.epub'] },
  { value: 'pdf', label: 'PDF', extensions: ['.pdf'] },
  { value: 'txt', label: 'TXT', extensions: ['.txt'] },
  { value: 'fb2', label: 'FB2', extensions: ['.fb2'] },
  { value: 'djvu', label: 'DJVU', extensions: ['.djvu'] },
  { value: 'chm', label: 'CHM', extensions: ['.chm'] },
  { value: 'lit', label: 'LIT', extensions: ['.lit'] },
  { value: 'lrf', label: 'LRF', extensions: ['.lrf'] },
  { value: 'docx', label: 'DOCX', extensions: ['.docx'] },
  { value: 'rtf', label: 'RTF', extensions: ['.rtf'] },
  { value: 'odt', label: 'ODT', extensions: ['.odt'] },
  { value: 'markdown', label: 'Markdown', extensions: ['.md', '.markdown'] },
  { value: 'html', label: 'HTML', extensions: ['.html', '.htm'] },
  { value: 'cbz', label: 'CBZ', extensions: ['.cbz'] },
  { value: 'cbt', label: 'CBT', extensions: ['.cbt'] }
]

export const FONT_FAMILIES = [
  { label: '系统默认', value: 'system-ui, -apple-system, "Segoe UI", "Noto Sans SC", sans-serif' },
  { label: '宋体/衬线 (Serif)', value: '"Noto Serif SC", "Source Han Serif SC", "SimSun", serif' },
  { label: '黑体/无衬线 (Sans)', value: '"Noto Sans SC", "Source Han Sans SC", "Microsoft YaHei", sans-serif' },
  { label: '等宽 (Mono)', value: '"JetBrains Mono", "Fira Code", "Consolas", "Courier New", monospace' },
  { label: '楷体', value: '"KaiTi", "STKaiti", "楷体", serif' },
  { label: '仿宋', value: '"FangSong", "STFangsong", "仿宋", serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Helvetica', value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: '自定义', value: '__custom__' }
]

export const SECURITY_QUESTIONS = [
  '你第一只宠物叫什么？',
  '你的出生城市是？',
  '你母亲的名字是？',
  '你的小学名称是？',
  '你最喜欢的书是？',
  '自定义问题'
]

// Author detection patterns — checked in first 40 lines and last 15 lines
export const AUTHOR_PATTERNS = [
  /作者[：:]\s*(.+)/i,
  /作者\s+(.+)/i,
  /Author[：:]\s*(.+)/i,
  /署名[：:]\s*(.+)/i,
  /撰写[：:]\s*(.+)/i,
  /撰文[：:]\s*(.+)/i,
  /著[：:]\s*(.+)/i,
  /著者[：:]\s*(.+)/i,
  /Written\s*by[：:]\s*(.+)/i,
  /By[：:]\s*(.+)/i,
  /编著[：:]\s*(.+)/i,
  /编[：:]\s*(.+)/i,
  /执笔[：:]\s*(.+)/i,
  /原作[：:]\s*(.+)/i
]

// Chapter detection patterns — checked globally (stricter, no separator patterns)
export const CHAPTER_PATTERNS = [
  /^第[零一二三四五六七八九十百千0-9]+[章节节卷部回篇集輯]\s*[：:]?\s*(.+)?/,
  /^第[零一二三四五六七八九十百千0-9]+[卷部回篇]?\s+[^\n]{2,30}$/,
  /^Chapter\s+\d+/i,
  /^Part\s+\d+/i,
  /^Section\s+\d+/i,
  /^(序言|前言|楔子|引子|番外|后记|尾声|附录)[：:]?\s*$/,
  /^(Prologue|Epilogue|Foreword|Preface|Introduction|Appendix)\s*$/i,
  /^(第一卷|第二卷|第三卷|第四卷|第五卷|第六卷|第七卷|第八卷|第九卷|第十卷)/,
  /^(第一册|第二册|第三册|第四册|第五册|上卷|中卷|下卷|上冊|中冊|下冊)\s*$/
]
