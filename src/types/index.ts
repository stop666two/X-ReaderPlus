export type ThemeMode = 'light' | 'dark' | 'sepia'
export type ReadingMode = 'scroll' | 'pagination' | 'auto'
export type ViewMode = 'grid' | 'list'
export type SortField = 'addedAt' | 'title' | 'author' | 'libraryName' | 'chapterCount'
export type SortOrder = 'asc' | 'desc'
export type AnnotationType = 'highlight' | 'note'
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange' | 'purple'
export type ImportMode = 'copy' | 'folder'

export type BookFormat =
  | 'epub' | 'txt' | 'markdown' | 'html'
  | 'fb2' | 'djvu'
  | 'docx' | 'rtf' | 'odt' | 'pdf'
  | 'cbr' | 'cbz' | 'cbt' | 'cb7'
  | 'chm' | 'lit' | 'lrf'

export interface Book {
  id: string
  title: string
  author: string
  cover: string
  path: string
  format: BookFormat
  size: number
  addedAt: number
  lastReadAt: number
  progress: number
  chapterIndex: number
  chapterProgress: number
  tags: string[]
  rating: number
  review: string
  wordCount: number
  chapterCount: number
  totalReadingTime: number
  libraryId: string
  contentHash?: string
}

export interface Library {
  id: string
  name: string
  path: string
  mode: ImportMode
  createdAt: number
  bookCount: number
}

export interface ChapterContent {
  title: string
  content: string
}

export interface Bookmark {
  id: string
  bookId: string
  name: string
  chapterIndex: number
  paragraphOffset: number
  createdAt: number
}

export interface Annotation {
  id: string
  bookId: string
  bookTitle?: string
  type: AnnotationType
  color: HighlightColor
  chapterIndex: number
  startOffset: number
  endOffset: number
  text: string
  note: string
  tags: string[]
  createdAt: number
  deleted?: boolean
}

export interface ParsedBook {
  metadata: { title: string; author: string; cover: string; format: BookFormat }
  chapters: ChapterContent[]
  rawToc: TocItem[]
  /** First 10K chars of raw decoded text, for debugging encoding issues */
  rawContent?: string
}

export interface TocItem {
  label: string
  href: string
  chapterIndex: number
  subitems?: TocItem[]
}

export interface ReadingSettings {
  fontSize: number
  lineHeight: number
  paragraphSpacing: number
  textIndent: number
  fontWeight: number
  fontFamily: string
  marginHorizontal: number
  pageWidth: number
  textAlign: 'left' | 'justify'
  showChapterTitle: boolean
  hyphenation: boolean
  fontSizeScale: number
  bgImageUrl: string
  bgOpacity: number
  customCSS: string
  showReadingStats: boolean
  autoSaveInterval: number
  letterSpacing: number
  wordSpacing: number
  firstLineIndent: boolean
  verticalText: boolean
  columnCount: number
  readingWidth: string
  pageAnimation: string
  hideScrollbar: boolean
  dimBackground: boolean
  lineFocus: boolean
  sepiaIntensity: number
  brightness: number
  contrast: number
}

export interface ThemeColors {
  primary: string
  secondary: string
  accent: string
  bgColor: string
  textColor: string
}

export interface CustomTheme {
  primary: string
  surface: string
  background: string
  textColor: string
}

export type CustomThemes = Record<string, CustomTheme>

export interface ReadingShortcuts {
  scrollUp: string
  scrollDown: string
  pageUp: string
  pageDown: string
  prevChapter: string
  nextChapter: string
  search: string
  chapterStart: string
  chapterEnd: string
  [key: string]: string
}

export interface AppSettings {
  readingSettings: ReadingSettings
  toolbarAutoHideDelay: number
  autoScrollSpeed: number
  themeColors: ThemeColors
  readingShortcuts?: ReadingShortcuts
  focusMode?: boolean
  customFonts?: CustomFont[]
}

export interface CustomFont {
  name: string
  family: string
  dataUrl: string
  format: 'truetype' | 'opentype' | 'woff' | 'woff2'
}

export interface SecurityQuestion {
  question: string
  answerHash: string
  answerSalt: string
}

export interface SearchResult {
  bookId: string
  bookTitle: string
  chapterIndex: number
  chapterTitle: string
  matchText: string
  matchPosition: number
}

export interface TrashItem {
  id: string
  book: Book
  deletedAt: number
}

export interface PinEscalation {
  firstAttempts: number
  firstLockDuration: number
  secondAttempts: number
  secondLockDuration: number
}

export interface PinState {
  isSet: boolean
  hash: string
  salt: string
  lockedUntil: number
  failedAttempts: number
  escalation?: PinEscalation
  encryptionKey?: string
}

export interface BackupData {
  version: string
  exportedAt: number
  libraries: Library[]
  books: Book[]
  chapters: Record<string, ChapterContent[]>
  bookmarks: Bookmark[]
  annotations: Annotation[]
  settings: Record<string, any>
  pinState: PinState | null
}
