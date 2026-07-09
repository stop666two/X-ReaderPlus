<template>
  <div class="dictionary-view">
    <v-tabs v-model="activeTab" density="compact" color="primary">
      <v-tab value="library">书库搜索</v-tab>
      <v-tab value="online">在线词典</v-tab>
      <v-tab value="history">最近查询</v-tab>
    </v-tabs>

    <v-divider />

    <v-window v-model="activeTab" class="tab-content">
      <!-- ==================== 书库搜索 ==================== -->
      <v-window-item value="library">
        <div class="pa-4">
          <!-- Search input -->
          <v-text-field
            v-model="searchQuery"
            prepend-inner-icon="mdi-magnify"
            placeholder="输入关键词搜索书库..."
            variant="outlined"
            density="compact"
            hide-details
            clearable
            @keyup.enter="searchLibrary"
          />

          <!-- Search scope checkboxes -->
          <div class="d-flex flex-wrap ga-2 mt-3 mb-2">
            <v-checkbox
              v-model="searchTitle"
              label="搜索标题"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="searchTags"
              label="搜索标签"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="searchContent"
              label="搜索正文"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="searchNotes"
              label="搜索笔记"
              density="compact"
              hide-details
            />
          </div>

          <!-- Search button -->
          <v-btn
            variant="tonal"
            color="primary"
            prepend-icon="mdi-magnify"
            block
            :loading="searching"
            :disabled="!searchQuery.trim()"
            @click="searchLibrary"
          >
            搜索书库
          </v-btn>

          <v-divider class="my-3" />

          <!-- Empty state -->
          <div v-if="!hasSearched" class="text-center py-8">
            <v-icon size="64" class="mb-2" color="medium-emphasis">mdi-book-search</v-icon>
            <p class="text-medium-emphasis">输入关键词并选择搜索范围</p>
            <p class="text-caption text-medium-emphasis">可同时搜索标题、标签、正文和笔记</p>
          </div>

          <!-- Searching -->
          <div v-else-if="searching" class="text-center pa-4">
            <v-progress-circular indeterminate color="primary" />
            <p class="text-caption mt-2">搜索中...</p>
          </div>

          <!-- Results -->
          <div v-else-if="searchResults.length > 0">
            <p class="text-body-2 mb-2">
              找到 {{ searchResults.length }} 个结果
            </p>
            <v-list density="compact" lines="two">
              <v-list-item
                v-for="(result, idx) in searchResults"
                :key="idx"
                :title="result.bookTitle"
                :subtitle="result.chapterTitle"
                @click="goToBook(result.bookId, result.chapterIndex)"
              >
                <template #prepend>
                  <v-icon>
                    {{ result.matchType === 'tag' ? 'mdi-tag' : result.matchType === 'note' ? 'mdi-note-text' : 'mdi-book' }}
                  </v-icon>
                </template>
                <template #append>
                  <v-chip size="x-small" :color="matchTypeColor(result.matchType)" variant="tonal">
                    {{ matchTypeLabel(result.matchType) }}
                  </v-chip>
                </template>
                <v-list-item-subtitle v-if="result.matchText" class="mt-1">
                  <span class="text-medium-emphasis">{{ truncateText(result.matchText, 120) }}</span>
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </div>

          <!-- No results -->
          <div v-else class="text-center py-8">
            <v-icon size="64" class="mb-2" color="medium-emphasis">mdi-file-search-outline</v-icon>
            <p class="text-medium-emphasis">未找到匹配结果</p>
            <p class="text-caption text-medium-emphasis">试试更换关键词或调整搜索范围</p>
          </div>
        </div>
      </v-window-item>

      <!-- ==================== 在线词典 ==================== -->
      <v-window-item value="online">
        <div class="pa-4">
          <!-- 查词输入 -->
          <v-text-field
            v-model="dictQuery"
            label="查词（自动识别中/英文）"
            placeholder="输入中文或英文单词..."
            variant="outlined"
            density="compact"
            hide-details
            @keyup.enter="lookupOnline"
            @update:model-value="onDictQueryChange"
          />

          <!-- 检测到的语言 -->
          <div v-if="dictQuery.trim() && detectedLang" class="mt-1">
            <v-chip size="x-small" :color="detectedLang === 'zh' ? 'warning' : 'info'" variant="tonal">
              <v-icon start size="x-small">
                {{ detectedLang === 'zh' ? 'mdi-ideogram-cjk' : 'mdi-alphabet-latin' }}
              </v-icon>
              {{ detectedLang === 'zh' ? '中文 → 英文' : 'English → 中文' }}
            </v-chip>
          </div>

          <v-btn
            variant="tonal"
            color="primary"
            prepend-icon="mdi-translate"
            block
            class="mt-3"
            :loading="dictLoading"
            :disabled="!dictQuery.trim()"
            @click="lookupOnline"
          >
            查词
          </v-btn>

          <v-divider class="my-3" />

          <!-- ===== English → Chinese (dictionaryapi.dev) ===== -->
          <div v-if="dictResult && dictResult.source === 'online'">
            <h3 class="text-h6 mb-1">{{ dictResult.word }}</h3>
            <div v-if="dictResult.phonetic" class="text-caption text-medium-emphasis mb-3">
              音标: {{ dictResult.phonetic }}
            </div>

            <div
              v-for="(meaning, idx) in dictResult.meanings"
              :key="idx"
              class="mb-4 meaning-block"
            >
              <v-chip size="small" :color="posColor(meaning.partOfSpeech)" variant="tonal" class="mb-2">
                {{ posLabel(meaning.partOfSpeech) }}
              </v-chip>
              <ol class="ml-6" style="padding-left: 0">
                <li
                  v-for="(def, dIdx) in meaning.definitions"
                  :key="dIdx"
                  class="mb-2 text-body-2"
                >
                  {{ def.definition }}
                  <v-chip
                    v-if="def.zhHint"
                    size="x-small"
                    color="green-lighten-1"
                    variant="text"
                    class="ml-2"
                  >
                    中: {{ def.zhHint }}
                  </v-chip>
                  <div
                    v-if="def.example"
                    class="text-caption text-medium-emphasis mt-1"
                  >
                    示例: &ldquo;{{ def.example }}&rdquo;
                  </div>
                </li>
              </ol>
            </div>
          </div>

          <!-- ===== Chinese → English (built-in) ===== -->
          <div v-else-if="dictResult && dictResult.source === 'builtin'">
            <h3 class="text-h6 mb-1">{{ dictResult.word }}</h3>

            <div v-if="dictResult.translations && dictResult.translations.length > 0">
              <p class="text-body-2 text-medium-emphasis mb-2">英文翻译:</p>
              <div class="d-flex flex-wrap ga-2 mb-3">
                <v-chip
                  v-for="(tr, idx) in dictResult.translations"
                  :key="idx"
                  color="primary"
                  variant="tonal"
                >
                  {{ tr.word }}
                  <v-tooltip v-if="tr.pos" location="top">
                    <template #activator="{ props }">
                      <span v-bind="props" class="text-caption ml-1">({{ tr.pos }})</span>
                    </template>
                    <span>{{ posLabel(tr.pos) }}</span>
                  </v-tooltip>
                </v-chip>
              </div>
            </div>

            <div v-if="dictResult.entries && dictResult.entries.length > 0" class="mt-4">
              <p class="text-body-2 text-medium-emphasis mb-2">释义:</p>
              <v-list density="compact">
                <v-list-item
                  v-for="(entry, idx) in dictResult.entries"
                  :key="idx"
                  class="px-0"
                >
                  <template #title>
                    <span class="text-body-2">{{ entry.en }}</span>
                    <v-chip
                      v-if="entry.pos"
                      size="x-small"
                      :color="posColor(entry.pos)"
                      variant="tonal"
                      class="ml-2"
                    >
                      {{ posLabel(entry.pos) }}
                    </v-chip>
                  </template>
                  <template #subtitle>
                    <span class="text-caption">{{ entry.zh }}</span>
                  </template>
                </v-list-item>
              </v-list>
            </div>

            <div v-if="!dictResult.translations?.length && !dictResult.entries?.length" class="text-center py-4">
              <p class="text-medium-emphasis">未找到该词的翻译</p>
              <p class="text-caption text-medium-emphasis">试试其他相近词汇</p>
            </div>
          </div>

          <!-- Error -->
          <div v-else-if="dictError" class="text-center py-4">
            <v-icon color="warning" size="48" class="mb-2">mdi-alert-circle</v-icon>
            <p class="text-medium-emphasis">{{ dictError }}</p>
            <p v-if="dictSuggestions.length > 0" class="text-caption mt-2">
              试试搜索:
              <v-chip
                v-for="s in dictSuggestions"
                :key="s"
                size="x-small"
                variant="tonal"
                class="ma-1"
                @click="dictQuery = s; lookupOnline()"
              >
                {{ s }}
              </v-chip>
            </p>
            <v-btn variant="tonal" size="small" class="mt-2" @click="lookupOnline">
              重试
            </v-btn>
          </div>

          <!-- Empty -->
          <div v-else class="text-center py-8">
            <v-icon size="64" class="mb-2" color="medium-emphasis">mdi-web</v-icon>
            <p class="text-medium-emphasis">查词（自动识别中/英文）</p>
            <p class="text-caption text-medium-emphasis">
              英文单词使用 dictionaryapi.dev 在线查询<br />
              中文词汇使用内置词典英译
            </p>
          </div>
        </div>
      </v-window-item>

      <!-- ==================== 最近查询 ==================== -->
      <v-window-item value="history">
        <div class="pa-4">
          <div v-if="recentQueries.length === 0" class="text-center py-8">
            <v-icon size="64" class="mb-2" color="medium-emphasis">mdi-history</v-icon>
            <p class="text-medium-emphasis">暂无查询记录</p>
            <p class="text-caption text-medium-emphasis">查询单词后将自动记录在此</p>
          </div>

          <div v-else>
            <div class="d-flex align-center mb-2">
              <span class="text-body-2 text-medium-emphasis">{{ recentQueries.length }} 条记录</span>
              <v-spacer />
              <v-btn
                variant="tonal"
                size="x-small"
                prepend-icon="mdi-delete-sweep"
                @click="clearAllQueries"
              >
                清空
              </v-btn>
            </div>

            <v-list density="compact">
              <v-list-item
                v-for="(query, idx) in recentQueries"
                :key="idx"
                :title="query.word"
                :subtitle="query.timestamp"
                @click="reSearch(query.word)"
              >
                <template #prepend>
                  <v-icon>mdi-history</v-icon>
                </template>
                <template #append>
                  <v-btn
                    variant="tonal"
                    icon="mdi-close"
                    size="x-small"
                    density="compact"
                    @click.stop="removeQuery(idx)"
                  />
                </template>
              </v-list-item>
            </v-list>
          </div>
        </div>
      </v-window-item>
    </v-window>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/services/db'
import { useBookshelfStore } from '@/stores/bookshelf'
import { logger } from '@/services/log'
import type { Book, ChapterContent, Annotation } from '@/types'
import dayjs from 'dayjs'

// ---- API helpers: prefer electronAPI, fall back to Dexie ----
const api = {
  ch: {
    toArray: () => window.electronAPI?.chapters?.getAll?.() ?? db.ch.toArray(),
    get: (bid: string) => window.electronAPI?.chapters?.get?.(bid) ?? db.ch.get(bid),
  },
  ann: {
    toArray: () => window.electronAPI?.annotations?.getAll?.() ?? db.ann.toArray(),
  },
  cfg: {
    get: async (k: string): Promise<string | null> => {
      if (window.electronAPI?.config?.get) {
        const v = await window.electronAPI.config.get(k)
        return v ?? null
      }
      const rec = await db.cfg.get(k)
      return rec?.v ?? null
    },
    put: async (k: string, v: string): Promise<void> => {
      if (window.electronAPI?.config?.set) {
        await window.electronAPI.config.set(k, v)
        return
      }
      await db.cfg.put({ k, v })
    },
  },
}

const router = useRouter()
const bookshelfStore = useBookshelfStore()

// ---- Tabs ----
const activeTab = ref('library')

// ---- Library search ----
const searchQuery = ref('')
const searchTitle = ref(true)
const searchTags = ref(true)
const searchContent = ref(true)
const searchNotes = ref(false)
const searching = ref(false)
const hasSearched = ref(false)
const searchResults = ref<SearchResultItem[]>([])

interface SearchResultItem {
  bookId: string
  bookTitle: string
  chapterIndex: number
  chapterTitle: string
  matchText: string
  matchType: 'title' | 'tag' | 'content' | 'note'
}

function matchTypeColor(type: string): string {
  switch (type) {
    case 'title': return 'success'
    case 'tag': return 'warning'
    case 'content': return 'primary'
    case 'note': return 'info'
    default: return ''
  }
}

function matchTypeLabel(type: string): string {
  switch (type) {
    case 'title': return '标题'
    case 'tag': return '标签'
    case 'content': return '正文'
    case 'note': return '笔记'
    default: return ''
  }
}

async function searchLibrary() {
  const q = searchQuery.value.trim()
  if (!q) return

  searching.value = true
  hasSearched.value = true
  searchResults.value = []

  try {
    const query = q.toLowerCase()
    const seen = new Set<string>()

    // 1) Search titles
    if (searchTitle.value) {
      for (const book of bookshelfStore.books) {
        if (book.title.toLowerCase().includes(query)) {
          const key = `${book.id}|-1|title`
          if (!seen.has(key)) {
            seen.add(key)
            searchResults.value.push({
              bookId: book.id,
              bookTitle: book.title,
              chapterIndex: -1,
              chapterTitle: '标题匹配',
              matchText: book.title,
              matchType: 'title'
            })
          }
        }
      }
    }

    // 2) Search tags
    if (searchTags.value) {
      for (const book of bookshelfStore.books) {
        const matchedTags = book.tags.filter(t => t.toLowerCase().includes(query))
        if (matchedTags.length > 0) {
          const key = `${book.id}|-1|tag`
          if (!seen.has(key)) {
            seen.add(key)
            searchResults.value.push({
              bookId: book.id,
              bookTitle: book.title,
              chapterIndex: -1,
              chapterTitle: '标签匹配',
              matchText: matchedTags.join('、'),
              matchType: 'tag'
            })
          }
        }
      }
    }

    // 3) Search content (chapters)
    if (searchContent.value) {
      const chRecords = await api.ch.toArray()
      for (const chRecord of chRecords) {
        if (searchResults.value.length >= 50) break

        const book = bookshelfStore.books.find(b => b.id === chRecord.bid)
        if (!book) continue

        const chData = typeof chRecord.data === 'string' ? chRecord.data : JSON.stringify(chRecord)
        const chapters: ChapterContent[] = JSON.parse(chData)
        for (let ci = 0; ci < chapters.length; ci++) {
          if (searchResults.value.length >= 50) break
          const chapter = chapters[ci]
          const stripped = chapter.content.replace(/<[^>]+>/g, '')
          if (!stripped.toLowerCase().includes(query)) continue

          const key = `${book.id}|${ci}|content`
          if (seen.has(key)) continue
          seen.add(key)

          const idx = stripped.toLowerCase().indexOf(query)
          const start = Math.max(0, idx - 30)
          const matchText = stripped.substring(start, idx + query.length + 30)

          searchResults.value.push({
            bookId: book.id,
            bookTitle: book.title,
            chapterIndex: ci,
            chapterTitle: chapter.title,
            matchText,
            matchType: 'content'
          })
        }
      }
    }

    // 4) Search notes (annotations of type 'note')
    if (searchNotes.value) {
      const annRecords = await api.ann.toArray()
      for (const annRecord of annRecords) {
        if (searchResults.value.length >= 50) break

        const annData = typeof annRecord.data === 'string' ? annRecord.data : JSON.stringify(annRecord)
        const ann: Annotation = JSON.parse(annData)
        if (ann.type !== 'note') continue

        const noteMatch = ann.note.toLowerCase().includes(query)
        const textMatch = ann.text.toLowerCase().includes(query)
        if (!noteMatch && !textMatch) continue

        const key = `${ann.bookId}|${ann.chapterIndex}|note`
        if (seen.has(key)) continue
        seen.add(key)

        const book = bookshelfStore.books.find(b => b.id === ann.bookId)
        if (!book) continue

        const chRecord = await api.ch.get(ann.bookId)
        // chRecord may be a string (electronAPI) or {bid, data} (Dexie)
        const rawChData: string | null = chRecord
          ? (typeof chRecord === 'string' ? chRecord : (chRecord as any).data)
          : null
        const chapters: ChapterContent[] = rawChData ? JSON.parse(rawChData) : []
        const chapterTitle =
          chapters[ann.chapterIndex]?.title || `第${ann.chapterIndex + 1}章`

        searchResults.value.push({
          bookId: ann.bookId,
          bookTitle: book.title,
          chapterIndex: ann.chapterIndex,
          chapterTitle,
          matchText: noteMatch ? ann.note : ann.text,
          matchType: 'note'
        })
      }
    }

    // Cap at 50
    if (searchResults.value.length > 50) {
      searchResults.value = searchResults.value.slice(0, 50)
    }
  } catch (e) {
    logger.error('搜索失败:', e)
  } finally {
    searching.value = false
  }
}

// ---- Online dictionary ----
const dictQuery = ref('')
const dictLoading = ref(false)
const dictResult = ref<any>(null)
const dictError = ref('')
const detectedLang = ref<'zh' | 'en' | ''>('')
const dictSuggestions = ref<string[]>([])

// ---- Part-of-speech helpers ----
function posColor(pos: string): string {
  const p = pos?.toLowerCase() || ''
  if (p.startsWith('noun') || p === 'n') return 'blue'
  if (p.startsWith('verb') || p === 'v') return 'green'
  if (p.startsWith('adjectiv') || p.startsWith('adj') || p === 'a') return 'orange'
  if (p.startsWith('adverb') || p === 'adv') return 'purple'
  if (p.startsWith('pronoun') || p === 'pron') return 'pink'
  if (p.startsWith('preposition') || p === 'prep') return 'teal'
  if (p.startsWith('conjunction') || p === 'conj') return 'brown'
  if (p.startsWith('interjection') || p === 'interj') return 'red'
  if (p.startsWith('determiner') || p === 'det') return 'cyan'
  if (p === 'numeral' || p === 'num') return 'indigo'
  return 'grey'
}

function posLabel(pos: string): string {
  const p = pos?.toLowerCase() || ''
  if (p.startsWith('noun')) return `名 ${pos}`
  if (p.startsWith('verb')) return `动 ${pos}`
  if (p.startsWith('adjectiv')) return `形 ${pos}`
  if (p.startsWith('adverb')) return `副 ${pos}`
  if (p.startsWith('pronoun')) return `代 ${pos}`
  if (p.startsWith('preposition')) return `介 ${pos}`
  if (p.startsWith('conjunction')) return `连 ${pos}`
  if (p.startsWith('interjection')) return `叹 ${pos}`
  if (p.startsWith('determiner')) return `限 ${pos}`
  return pos || '其他'
}

// ---- Language detection ----
function detectLanguage(text: string): 'zh' | 'en' | '' {
  if (!text.trim()) return ''
  // Check if contains Chinese characters
  if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(text)) return 'zh'
  // Otherwise treat as English
  return 'en'
}

function onDictQueryChange() {
  detectedLang.value = detectLanguage(dictQuery.value)
  dictSuggestions.value = []
}

// ---- Built-in EN↔ZH dictionary ----
const BUILTIN_DICT_EN_ZH: Record<string, string> = {
  // Common
  'the': '这/那（定冠词）', 'a': '一个', 'an': '一个',
  'be': '是；存在', 'is': '是', 'are': '是', 'was': '是（过去式）', 'were': '是（过去式）',
  'have': '有', 'has': '有', 'had': '有（过去式）', 'do': '做', 'does': '做', 'did': '做（过去式）',
  'will': '将会', 'would': '将会（过去式）', 'can': '能够', 'could': '能够（过去式）',
  'should': '应该', 'may': '可以；可能', 'might': '可能', 'must': '必须',
  'say': '说', 'go': '去', 'get': '得到；变得', 'make': '制作；使', 'know': '知道',
  'think': '想；认为', 'see': '看见', 'come': '来', 'take': '拿；带', 'want': '想要',
  'look': '看', 'use': '使用', 'find': '找到；发现', 'give': '给', 'tell': '告诉',
  'work': '工作', 'call': '叫；打电话', 'try': '尝试', 'ask': '问', 'need': '需要',
  'feel': '感觉', 'become': '变成', 'leave': '离开', 'put': '放', 'mean': '意思是',
  'keep': '保持', 'let': '让', 'begin': '开始', 'seem': '似乎', 'help': '帮助',
  'show': '展示', 'hear': '听见', 'play': '玩', 'run': '跑', 'move': '移动',
  'live': '生活；住', 'believe': '相信', 'hold': '持有', 'bring': '带来', 'happen': '发生',
  'write': '写', 'provide': '提供', 'sit': '坐', 'stand': '站立', 'lose': '失去',
  'pay': '支付', 'meet': '遇见', 'include': '包括', 'continue': '继续', 'set': '设置',
  'learn': '学习', 'change': '改变', 'lead': '领导', 'understand': '理解', 'watch': '观看',
  'follow': '跟随', 'stop': '停止', 'create': '创造', 'speak': '说话', 'read': '阅读',
  'allow': '允许', 'add': '添加', 'spend': '花费', 'grow': '成长', 'open': '打开；开放的',
  'walk': '走', 'win': '赢', 'offer': '提供', 'remember': '记住', 'consider': '考虑',
  'appear': '出现', 'buy': '买', 'wait': '等待', 'serve': '服务', 'die': '死',
  'send': '发送', 'expect': '期望', 'build': '建造', 'stay': '停留', 'fall': '落下',
  'cut': '切', 'reach': '到达', 'kill': '杀', 'remain': '保持', 'suggest': '建议',
  'raise': '提高', 'pass': '通过', 'sell': '卖', 'require': '要求', 'report': '报告',
  'decide': '决定', 'pull': '拉', 'break': '打破', 'receive': '收到', 'agree': '同意',
  'support': '支持', 'produce': '生产', 'eat': '吃', 'cover': '覆盖', 'catch': '抓住',
  'draw': '画', 'choose': '选择', 'cause': '导致', 'describe': '描述', 'discuss': '讨论',
  'pick': '挑选', 'develop': '发展', 'sing': '唱', 'deal': '处理', 'share': '分享',
  // Nouns
  'time': '时间', 'year': '年', 'people': '人；人们', 'way': '方式；路', 'day': '天',
  'man': '男人', 'woman': '女人', 'child': '孩子', 'world': '世界', 'life': '生活；生命',
  'hand': '手', 'part': '部分', 'place': '地方', 'case': '情况；案例', 'week': '周',
  'company': '公司', 'system': '系统', 'program': '程序', 'question': '问题',
  'government': '政府', 'number': '数字', 'night': '夜晚', 'point': '点；要点',
  'home': '家', 'water': '水', 'room': '房间', 'mother': '母亲', 'area': '区域',
  'money': '钱', 'story': '故事', 'fact': '事实', 'month': '月', 'lot': '许多',
  'right': '权利；右边；正确的', 'study': '学习', 'book': '书', 'eye': '眼睛', 'job': '工作',
  'word': '词', 'business': '商业', 'issue': '问题', 'side': '边', 'kind': '种类',
  'head': '头', 'house': '房子', 'service': '服务', 'friend': '朋友', 'father': '父亲',
  'power': '力量；权力', 'hour': '小时', 'game': '游戏', 'line': '线', 'end': '结束',
  'member': '成员', 'law': '法律', 'car': '车', 'city': '城市', 'community': '社区',
  'name': '名字', 'president': '总统', 'team': '团队', 'minute': '分钟', 'idea': '想法',
  'body': '身体', 'information': '信息', 'back': '背部', 'parent': '父母', 'face': '脸',
  'others': '其他人', 'level': '水平', 'office': '办公室', 'door': '门', 'health': '健康',
  'person': '人', 'art': '艺术', 'war': '战争', 'history': '历史', 'party': '聚会；政党',
  'result': '结果', 'morning': '早晨', 'reason': '原因', 'research': '研究', 'girl': '女孩',
  'guy': '家伙', 'moment': '时刻', 'air': '空气', 'teacher': '老师', 'force': '力量',
  'education': '教育', 'food': '食物', 'nature': '自然', 'color': '颜色', 'store': '商店',
  'language': '语言', 'mind': '思想', 'class': '班级', 'nation': '国家',
  // Adjectives
  'good': '好的', 'new': '新的', 'first': '第一', 'last': '最后', 'long': '长的',
  'great': '伟大的', 'little': '小的', 'own': '自己的', 'other': '其他的', 'old': '老的；旧的',
  'big': '大的', 'high': '高的', 'different': '不同的', 'small': '小的',
  'large': '大的', 'next': '下一个', 'early': '早的', 'young': '年轻的', 'important': '重要的',
  'few': '很少的', 'public': '公共的', 'bad': '坏的', 'same': '相同的', 'able': '能够的',
  'possible': '可能的', 'hard': '硬的；困难的', 'sure': '确定的', 'real': '真实的',
  'simple': '简单的', 'strong': '强壮的', 'free': '自由的；免费的', 'full': '满的',
  'special': '特别的', 'clear': '清楚的', 'true': '真的',
  'whole': '全部的', 'white': '白色的', 'black': '黑色的', 'best': '最好的',
  'better': '更好的', 'ready': '准备好的', 'happy': '快乐的', 'past': '过去的',
  'social': '社会的', 'common': '常见的', 'poor': '贫穷的', 'natural': '自然的',
  'similar': '相似的', 'human': '人类的', 'dead': '死的', 'local': '当地的',
  'popular': '流行的', 'beautiful': '美丽的', 'recent': '最近的', 'necessary': '必要的',
  'available': '可用的', 'likely': '可能的', 'foreign': '外国的', 'official': '官方的',
  'serious': '严肃的', 'difficult': '困难的', 'political': '政治的', 'wonderful': '精彩的',
  // More general
  'very': '非常', 'too': '太；也', 'also': '也', 'just': '只是；刚刚', 'now': '现在',
  'here': '这里', 'there': '那里', 'then': '然后', 'so': '所以；如此', 'well': '好地',
  'only': '只有', 'still': '仍然', 'even': '甚至', 'already': '已经', 'always': '总是',
  'never': '从不', 'often': '经常', 'sometimes': '有时', 'usually': '通常',
  'really': '真的', 'perhaps': '也许', 'certainly': '当然', 'together': '一起',
  'almost': '几乎', 'enough': '足够的', 'quite': '相当', 'actually': '实际上',
  'suddenly': '突然', 'finally': '最终', 'quickly': '迅速地', 'slowly': '慢慢地',
  'easily': '容易地', 'carefully': '小心地', 'simply': '简单地', 'exactly': '确切地',
  'probably': '可能', 'especially': '尤其', 'immediately': '立即',
}

const BUILTIN_DICT_ZH_EN: Record<string, Array<{ word: string; pos?: string }>> = {
  // Common Chinese → English
  '时间': [{ word: 'time', pos: 'noun' }],
  '年': [{ word: 'year', pos: 'noun' }],
  '人': [{ word: 'person', pos: 'noun' }, { word: 'people', pos: 'noun' }],
  '方式': [{ word: 'way', pos: 'noun' }, { word: 'method', pos: 'noun' }],
  '天': [{ word: 'day', pos: 'noun' }],
  '男人': [{ word: 'man', pos: 'noun' }],
  '女人': [{ word: 'woman', pos: 'noun' }],
  '孩子': [{ word: 'child', pos: 'noun' }],
  '世界': [{ word: 'world', pos: 'noun' }],
  '生活': [{ word: 'life', pos: 'noun' }],
  '手': [{ word: 'hand', pos: 'noun' }],
  '部分': [{ word: 'part', pos: 'noun' }],
  '地方': [{ word: 'place', pos: 'noun' }],
  '情况': [{ word: 'case', pos: 'noun' }, { word: 'situation', pos: 'noun' }],
  '周': [{ word: 'week', pos: 'noun' }],
  '公司': [{ word: 'company', pos: 'noun' }],
  '系统': [{ word: 'system', pos: 'noun' }],
  '程序': [{ word: 'program', pos: 'noun' }],
  '问题': [{ word: 'question', pos: 'noun' }, { word: 'problem', pos: 'noun' }, { word: 'issue', pos: 'noun' }],
  '政府': [{ word: 'government', pos: 'noun' }],
  '数字': [{ word: 'number', pos: 'noun' }],
  '夜晚': [{ word: 'night', pos: 'noun' }],
  '点': [{ word: 'point', pos: 'noun' }],
  '家': [{ word: 'home', pos: 'noun' }, { word: 'family', pos: 'noun' }],
  '水': [{ word: 'water', pos: 'noun' }],
  '房间': [{ word: 'room', pos: 'noun' }],
  '母亲': [{ word: 'mother', pos: 'noun' }],
  '区域': [{ word: 'area', pos: 'noun' }],
  '钱': [{ word: 'money', pos: 'noun' }],
  '故事': [{ word: 'story', pos: 'noun' }],
  '事实': [{ word: 'fact', pos: 'noun' }],
  '月': [{ word: 'month', pos: 'noun' }],
  '权利': [{ word: 'right', pos: 'noun' }],
  '学习': [{ word: 'study', pos: 'noun' }, { word: 'learn', pos: 'verb' }],
  '书': [{ word: 'book', pos: 'noun' }],
  '眼睛': [{ word: 'eye', pos: 'noun' }],
  '工作': [{ word: 'work', pos: 'noun' }, { word: 'job', pos: 'noun' }],
  '词': [{ word: 'word', pos: 'noun' }],
  '商业': [{ word: 'business', pos: 'noun' }],
  '边': [{ word: 'side', pos: 'noun' }],
  '种类': [{ word: 'kind', pos: 'noun' }, { word: 'type', pos: 'noun' }],
  '头': [{ word: 'head', pos: 'noun' }],
  '房子': [{ word: 'house', pos: 'noun' }],
  '服务': [{ word: 'service', pos: 'noun' }],
  '朋友': [{ word: 'friend', pos: 'noun' }],
  '父亲': [{ word: 'father', pos: 'noun' }],
  '力量': [{ word: 'power', pos: 'noun' }, { word: 'force', pos: 'noun' }],
  '小时': [{ word: 'hour', pos: 'noun' }],
  '游戏': [{ word: 'game', pos: 'noun' }],
  '线': [{ word: 'line', pos: 'noun' }],
  '结束': [{ word: 'end', pos: 'noun' }],
  '成员': [{ word: 'member', pos: 'noun' }],
  '法律': [{ word: 'law', pos: 'noun' }],
  '车': [{ word: 'car', pos: 'noun' }],
  '城市': [{ word: 'city', pos: 'noun' }],
  '社区': [{ word: 'community', pos: 'noun' }],
  '名字': [{ word: 'name', pos: 'noun' }],
  '团队': [{ word: 'team', pos: 'noun' }],
  '分钟': [{ word: 'minute', pos: 'noun' }],
  '想法': [{ word: 'idea', pos: 'noun' }],
  '身体': [{ word: 'body', pos: 'noun' }],
  '信息': [{ word: 'information', pos: 'noun' }],
  '父母': [{ word: 'parent', pos: 'noun' }],
  '脸': [{ word: 'face', pos: 'noun' }],
  '水平': [{ word: 'level', pos: 'noun' }],
  '办公室': [{ word: 'office', pos: 'noun' }],
  '门': [{ word: 'door', pos: 'noun' }],
  '健康': [{ word: 'health', pos: 'noun' }],
  '艺术': [{ word: 'art', pos: 'noun' }],
  '战争': [{ word: 'war', pos: 'noun' }],
  '历史': [{ word: 'history', pos: 'noun' }],
  '聚会': [{ word: 'party', pos: 'noun' }],
  '结果': [{ word: 'result', pos: 'noun' }],
  '早晨': [{ word: 'morning', pos: 'noun' }],
  '原因': [{ word: 'reason', pos: 'noun' }],
  '研究': [{ word: 'research', pos: 'noun' }],
  '女孩': [{ word: 'girl', pos: 'noun' }],
  '空气': [{ word: 'air', pos: 'noun' }],
  '老师': [{ word: 'teacher', pos: 'noun' }],
  '教育': [{ word: 'education', pos: 'noun' }],
  '食物': [{ word: 'food', pos: 'noun' }],
  '自然': [{ word: 'nature', pos: 'noun' }],
  '颜色': [{ word: 'color', pos: 'noun' }],
  '商店': [{ word: 'store', pos: 'noun' }, { word: 'shop', pos: 'noun' }],
  '语言': [{ word: 'language', pos: 'noun' }],
  '思想': [{ word: 'mind', pos: 'noun' }, { word: 'thought', pos: 'noun' }],
  '班级': [{ word: 'class', pos: 'noun' }],
  '国家': [{ word: 'nation', pos: 'noun' }, { word: 'country', pos: 'noun' }],
  '好的': [{ word: 'good', pos: 'adjective' }],
  '新的': [{ word: 'new', pos: 'adjective' }],
  '第一': [{ word: 'first', pos: 'adjective' }],
  '最后': [{ word: 'last', pos: 'adjective' }],
  '长的': [{ word: 'long', pos: 'adjective' }],
  '伟大的': [{ word: 'great', pos: 'adjective' }],
  '小的': [{ word: 'small', pos: 'adjective' }, { word: 'little', pos: 'adjective' }],
  '老的': [{ word: 'old', pos: 'adjective' }],
  '正确的': [{ word: 'right', pos: 'adjective' }, { word: 'correct', pos: 'adjective' }],
  '大的': [{ word: 'big', pos: 'adjective' }, { word: 'large', pos: 'adjective' }],
  '高的': [{ word: 'high', pos: 'adjective' }, { word: 'tall', pos: 'adjective' }],
  '不同的': [{ word: 'different', pos: 'adjective' }],
  '下一个': [{ word: 'next', pos: 'adjective' }],
  '重要的': [{ word: 'important', pos: 'adjective' }],
  '公共的': [{ word: 'public', pos: 'adjective' }],
  '坏的': [{ word: 'bad', pos: 'adjective' }],
  '相同的': [{ word: 'same', pos: 'adjective' }],
  '可能的': [{ word: 'possible', pos: 'adjective' }],
  '困难的': [{ word: 'difficult', pos: 'adjective' }, { word: 'hard', pos: 'adjective' }],
  '确定的': [{ word: 'sure', pos: 'adjective' }, { word: 'certain', pos: 'adjective' }],
  '真实的': [{ word: 'real', pos: 'adjective' }, { word: 'true', pos: 'adjective' }],
  '简单的': [{ word: 'simple', pos: 'adjective' }],
  '强壮的': [{ word: 'strong', pos: 'adjective' }],
  '自由的': [{ word: 'free', pos: 'adjective' }],
  '特别的': [{ word: 'special', pos: 'adjective' }],
  '清楚的': [{ word: 'clear', pos: 'adjective' }],
  '开放的': [{ word: 'open', pos: 'adjective' }],
  '全部的': [{ word: 'whole', pos: 'adjective' }],
  '白色的': [{ word: 'white', pos: 'adjective' }],
  '黑色的': [{ word: 'black', pos: 'adjective' }],
  '最好的': [{ word: 'best', pos: 'adjective' }],
  '更好的': [{ word: 'better', pos: 'adjective' }],
  '快乐的': [{ word: 'happy', pos: 'adjective' }],
  '社会的': [{ word: 'social', pos: 'adjective' }],
  '常见的': [{ word: 'common', pos: 'adjective' }],
  '贫穷的': [{ word: 'poor', pos: 'adjective' }],
  '自然的': [{ word: 'natural', pos: 'adjective' }],
  '相似的': [{ word: 'similar', pos: 'adjective' }],
  '人类的': [{ word: 'human', pos: 'adjective' }],
  '本地的': [{ word: 'local', pos: 'adjective' }],
  '流行的': [{ word: 'popular', pos: 'adjective' }],
  '美丽的': [{ word: 'beautiful', pos: 'adjective' }],
  '最近的': [{ word: 'recent', pos: 'adjective' }],
  '必要的': [{ word: 'necessary', pos: 'adjective' }],
  '可用的': [{ word: 'available', pos: 'adjective' }],
  '外国的': [{ word: 'foreign', pos: 'adjective' }],
  '官方的': [{ word: 'official', pos: 'adjective' }],
  '严肃的': [{ word: 'serious', pos: 'adjective' }],
  '政治的': [{ word: 'political', pos: 'adjective' }],
  '精彩的': [{ word: 'wonderful', pos: 'adjective' }],
  '说': [{ word: 'say', pos: 'verb' }, { word: 'speak', pos: 'verb' }],
  '去': [{ word: 'go', pos: 'verb' }],
  '得到': [{ word: 'get', pos: 'verb' }],
  '制作': [{ word: 'make', pos: 'verb' }],
  '知道': [{ word: 'know', pos: 'verb' }],
  '想': [{ word: 'think', pos: 'verb' }, { word: 'want', pos: 'verb' }],
  '看见': [{ word: 'see', pos: 'verb' }],
  '来': [{ word: 'come', pos: 'verb' }],
  '拿': [{ word: 'take', pos: 'verb' }],
  '想要': [{ word: 'want', pos: 'verb' }],
  '看': [{ word: 'look', pos: 'verb' }, { word: 'see', pos: 'verb' }],
  '使用': [{ word: 'use', pos: 'verb' }],
  '找到': [{ word: 'find', pos: 'verb' }],
  '给': [{ word: 'give', pos: 'verb' }],
  '告诉': [{ word: 'tell', pos: 'verb' }],
  '尝试': [{ word: 'try', pos: 'verb' }],
  '问': [{ word: 'ask', pos: 'verb' }],
  '需要': [{ word: 'need', pos: 'verb' }],
  '感觉': [{ word: 'feel', pos: 'verb' }],
  '变成': [{ word: 'become', pos: 'verb' }],
  '离开': [{ word: 'leave', pos: 'verb' }],
  '放': [{ word: 'put', pos: 'verb' }],
  '意思是': [{ word: 'mean', pos: 'verb' }],
  '保持': [{ word: 'keep', pos: 'verb' }],
  '让': [{ word: 'let', pos: 'verb' }],
  '开始': [{ word: 'begin', pos: 'verb' }, { word: 'start', pos: 'verb' }],
  '似乎': [{ word: 'seem', pos: 'verb' }],
  '帮助': [{ word: 'help', pos: 'verb' }],
  '展示': [{ word: 'show', pos: 'verb' }],
  '听见': [{ word: 'hear', pos: 'verb' }],
  '玩': [{ word: 'play', pos: 'verb' }],
  '跑': [{ word: 'run', pos: 'verb' }],
  '移动': [{ word: 'move', pos: 'verb' }],
  '相信': [{ word: 'believe', pos: 'verb' }],
  '带来': [{ word: 'bring', pos: 'verb' }],
  '发生': [{ word: 'happen', pos: 'verb' }],
  '写': [{ word: 'write', pos: 'verb' }],
  '提供': [{ word: 'provide', pos: 'verb' }, { word: 'offer', pos: 'verb' }],
  '坐': [{ word: 'sit', pos: 'verb' }],
  '站立': [{ word: 'stand', pos: 'verb' }],
  '失去': [{ word: 'lose', pos: 'verb' }],
  '支付': [{ word: 'pay', pos: 'verb' }],
  '遇见': [{ word: 'meet', pos: 'verb' }],
  '包括': [{ word: 'include', pos: 'verb' }],
  '继续': [{ word: 'continue', pos: 'verb' }],
  '设置': [{ word: 'set', pos: 'verb' }],
  '改变': [{ word: 'change', pos: 'verb' }],
  '领导': [{ word: 'lead', pos: 'verb' }],
  '理解': [{ word: 'understand', pos: 'verb' }],
  '跟随': [{ word: 'follow', pos: 'verb' }],
  '停止': [{ word: 'stop', pos: 'verb' }],
  '创造': [{ word: 'create', pos: 'verb' }],
  '阅读': [{ word: 'read', pos: 'verb' }],
  '允许': [{ word: 'allow', pos: 'verb' }],
  '添加': [{ word: 'add', pos: 'verb' }],
  '花费': [{ word: 'spend', pos: 'verb' }],
  '成长': [{ word: 'grow', pos: 'verb' }],
  '打开': [{ word: 'open', pos: 'verb' }],
  '走': [{ word: 'walk', pos: 'verb' }],
  '赢': [{ word: 'win', pos: 'verb' }],
  '记住': [{ word: 'remember', pos: 'verb' }],
  '考虑': [{ word: 'consider', pos: 'verb' }],
  '出现': [{ word: 'appear', pos: 'verb' }],
  '买': [{ word: 'buy', pos: 'verb' }],
  '等待': [{ word: 'wait', pos: 'verb' }],
  '死亡': [{ word: 'die', pos: 'verb' }],
  '发送': [{ word: 'send', pos: 'verb' }],
  '期望': [{ word: 'expect', pos: 'verb' }],
  '建造': [{ word: 'build', pos: 'verb' }],
  '落下': [{ word: 'fall', pos: 'verb' }],
  '切': [{ word: 'cut', pos: 'verb' }],
  '到达': [{ word: 'reach', pos: 'verb' }],
  '杀': [{ word: 'kill', pos: 'verb' }],
  '建议': [{ word: 'suggest', pos: 'verb' }],
  '提高': [{ word: 'raise', pos: 'verb' }, { word: 'improve', pos: 'verb' }],
  '通过': [{ word: 'pass', pos: 'verb' }],
  '卖': [{ word: 'sell', pos: 'verb' }],
  '要求': [{ word: 'require', pos: 'verb' }],
  '报告': [{ word: 'report', pos: 'verb' }],
  '决定': [{ word: 'decide', pos: 'verb' }],
  '拉': [{ word: 'pull', pos: 'verb' }],
  '打破': [{ word: 'break', pos: 'verb' }],
  '收到': [{ word: 'receive', pos: 'verb' }],
  '同意': [{ word: 'agree', pos: 'verb' }],
  '支持': [{ word: 'support', pos: 'verb' }],
  '生产': [{ word: 'produce', pos: 'verb' }],
  '吃': [{ word: 'eat', pos: 'verb' }],
  '覆盖': [{ word: 'cover', pos: 'verb' }],
  '抓住': [{ word: 'catch', pos: 'verb' }],
  '画': [{ word: 'draw', pos: 'verb' }],
  '选择': [{ word: 'choose', pos: 'verb' }],
  '导致': [{ word: 'cause', pos: 'verb' }],
  '描述': [{ word: 'describe', pos: 'verb' }],
  '讨论': [{ word: 'discuss', pos: 'verb' }],
  '挑选': [{ word: 'pick', pos: 'verb' }],
  '发展': [{ word: 'develop', pos: 'verb' }],
  '唱': [{ word: 'sing', pos: 'verb' }],
  '分享': [{ word: 'share', pos: 'verb' }],
  '非常': [{ word: 'very', pos: 'adverb' }],
  '也': [{ word: 'also', pos: 'adverb' }, { word: 'too', pos: 'adverb' }],
  '只是': [{ word: 'just', pos: 'adverb' }],
  '现在': [{ word: 'now', pos: 'adverb' }],
  '这里': [{ word: 'here', pos: 'adverb' }],
  '那里': [{ word: 'there', pos: 'adverb' }],
  '然后': [{ word: 'then', pos: 'adverb' }],
  '总是': [{ word: 'always', pos: 'adverb' }],
  '从不': [{ word: 'never', pos: 'adverb' }],
  '经常': [{ word: 'often', pos: 'adverb' }],
  '有时': [{ word: 'sometimes', pos: 'adverb' }],
  '通常': [{ word: 'usually', pos: 'adverb' }],
  '真的': [{ word: 'really', pos: 'adverb' }],
  '也许': [{ word: 'perhaps', pos: 'adverb' }],
  '当然': [{ word: 'certainly', pos: 'adverb' }],
  '一起': [{ word: 'together', pos: 'adverb' }],
  '几乎': [{ word: 'almost', pos: 'adverb' }],
  '足够的': [{ word: 'enough', pos: 'adverb' }],
  '实际上': [{ word: 'actually', pos: 'adverb' }],
  '突然': [{ word: 'suddenly', pos: 'adverb' }],
  '最终': [{ word: 'finally', pos: 'adverb' }],
  '迅速地': [{ word: 'quickly', pos: 'adverb' }],
  '慢慢地': [{ word: 'slowly', pos: 'adverb' }],
  '容易地': [{ word: 'easily', pos: 'adverb' }],
  '小心地': [{ word: 'carefully', pos: 'adverb' }],
  '简单地': [{ word: 'simply', pos: 'adverb' }],
  '确切地': [{ word: 'exactly', pos: 'adverb' }],
  '可能': [{ word: 'probably', pos: 'adverb' }, { word: 'maybe', pos: 'adverb' }],
  '尤其': [{ word: 'especially', pos: 'adverb' }],
  '立即': [{ word: 'immediately', pos: 'adverb' }],
  // Some compound/phrase lookups
  '电脑': [{ word: 'computer', pos: 'noun' }],
  '手机': [{ word: 'phone', pos: 'noun' }, { word: 'mobile phone', pos: 'noun' }],
  '互联网': [{ word: 'internet', pos: 'noun' }],
  '软件': [{ word: 'software', pos: 'noun' }],
  '硬件': [{ word: 'hardware', pos: 'noun' }],
  '数据': [{ word: 'data', pos: 'noun' }],
  '网络': [{ word: 'network', pos: 'noun' }],
  '安全': [{ word: 'security', pos: 'noun' }, { word: 'safety', pos: 'noun' }],
  '学校': [{ word: 'school', pos: 'noun' }],
  '医院': [{ word: 'hospital', pos: 'noun' }],
  '图书馆': [{ word: 'library', pos: 'noun' }],
  '市场': [{ word: 'market', pos: 'noun' }],
  '银行': [{ word: 'bank', pos: 'noun' }],
  '经济': [{ word: 'economy', pos: 'noun' }],
  '科学': [{ word: 'science', pos: 'noun' }],
  '技术': [{ word: 'technology', pos: 'noun' }],
  '音乐': [{ word: 'music', pos: 'noun' }],
  '电影': [{ word: 'movie', pos: 'noun' }, { word: 'film', pos: 'noun' }],
  '图片': [{ word: 'picture', pos: 'noun' }, { word: 'image', pos: 'noun' }],
  '视频': [{ word: 'video', pos: 'noun' }],
  '声音': [{ word: 'sound', pos: 'noun' }, { word: 'voice', pos: 'noun' }],
  '太阳': [{ word: 'sun', pos: 'noun' }],
  '月亮': [{ word: 'moon', pos: 'noun' }],
  '星星': [{ word: 'star', pos: 'noun' }],
  '地球': [{ word: 'earth', pos: 'noun' }],
  '火': [{ word: 'fire', pos: 'noun' }],
  '树': [{ word: 'tree', pos: 'noun' }],
  '花': [{ word: 'flower', pos: 'noun' }],
  '动物': [{ word: 'animal', pos: 'noun' }],
  '狗': [{ word: 'dog', pos: 'noun' }],
  '猫': [{ word: 'cat', pos: 'noun' }],
  '鸟': [{ word: 'bird', pos: 'noun' }],
  '鱼': [{ word: 'fish', pos: 'noun' }],
  '马': [{ word: 'horse', pos: 'noun' }],
  '爱': [{ word: 'love', pos: 'noun' }, { word: 'love', pos: 'verb' }],
  '希望': [{ word: 'hope', pos: 'noun' }, { word: 'hope', pos: 'verb' }],
  '梦想': [{ word: 'dream', pos: 'noun' }, { word: 'dream', pos: 'verb' }],
  '成功': [{ word: 'success', pos: 'noun' }],
  '失败': [{ word: 'failure', pos: 'noun' }],
  '机会': [{ word: 'opportunity', pos: 'noun' }, { word: 'chance', pos: 'noun' }],
  '经验': [{ word: 'experience', pos: 'noun' }],
  '知识': [{ word: 'knowledge', pos: 'noun' }],
  '能力': [{ word: 'ability', pos: 'noun' }],
  '环境': [{ word: 'environment', pos: 'noun' }],
  '资源': [{ word: 'resource', pos: 'noun' }],
  '项目': [{ word: 'project', pos: 'noun' }],
  '计划': [{ word: 'plan', pos: 'noun' }, { word: 'plan', pos: 'verb' }],
  '设计': [{ word: 'design', pos: 'noun' }, { word: 'design', pos: 'verb' }],
  '分析': [{ word: 'analysis', pos: 'noun' }, { word: 'analyze', pos: 'verb' }],
  '管理': [{ word: 'management', pos: 'noun' }, { word: 'manage', pos: 'verb' }],
  '组织': [{ word: 'organization', pos: 'noun' }, { word: 'organize', pos: 'verb' }],
  '政策': [{ word: 'policy', pos: 'noun' }],
  '文化': [{ word: 'culture', pos: 'noun' }],
  '传统': [{ word: 'tradition', pos: 'noun' }],
  '价值': [{ word: 'value', pos: 'noun' }],
  '质量': [{ word: 'quality', pos: 'noun' }],
  '关系': [{ word: 'relationship', pos: 'noun' }],
  '社会': [{ word: 'society', pos: 'noun' }],
  '幸福': [{ word: 'happiness', pos: 'noun' }],
}

// ---- Chinese hint mapping for English definitions ----
function getZhHint(word: string, definition: string): string {
  // Direct lookup in built-in dictionary
  const direct = BUILTIN_DICT_EN_ZH[word.toLowerCase()]
  if (direct) return direct

  // Try to match the definition against known patterns
  const defLower = definition.toLowerCase()
  for (const [en, zh] of Object.entries(BUILTIN_DICT_EN_ZH)) {
    if (defLower.includes(en) && en.length > 3) {
      return zh
    }
  }

  return ''
}

// ---- Chinese → English lookup ----
function lookupZhToEn(word: string): { translations: Array<{ word: string; pos?: string }>; entries: Array<{ en: string; zh: string; pos?: string }> } {
  // Direct match
  const direct = BUILTIN_DICT_ZH_EN[word]
  if (direct) {
    return { translations: direct, entries: [] }
  }

  // Fuzzy match: check if the Chinese text is a substring of any key
  const translations: Array<{ word: string; pos?: string }> = []
  const entries: Array<{ en: string; zh: string; pos?: string }> = []

  for (const [zh, enList] of Object.entries(BUILTIN_DICT_ZH_EN)) {
    if (zh.includes(word) || word.includes(zh)) {
      for (const en of enList) {
        translations.push(en)
      }
    }
  }

  // Try reverse lookup: search EN→ZH for words whose Chinese translation contains the query
  for (const [en, zh] of Object.entries(BUILTIN_DICT_EN_ZH)) {
    if (zh.includes(word)) {
      entries.push({ en, zh, pos: '' })
    }
  }

  return { translations, entries }
}

let _dictAbort: AbortController | null = null

// ---- Main lookup ----
async function lookupOnline() {
  if (!dictQuery.value.trim()) return
  // Cancel previous in-flight request
  if (_dictAbort) _dictAbort.abort()
  _dictAbort = new AbortController()
  const { signal } = _dictAbort

  dictLoading.value = true
  dictError.value = ''
  dictResult.value = null
  dictSuggestions.value = []

  const word = dictQuery.value.trim()
  const lang = detectLanguage(word)

  try {
    if (lang === 'zh') {
      // ---- Chinese → English (built-in dictionary) ----
      const result = lookupZhToEn(word)

      if (result.translations.length > 0 || result.entries.length > 0) {
        dictResult.value = {
          word,
          source: 'builtin',
          translations: result.translations,
          entries: result.entries,
        }
      } else {
        dictError.value = `未找到"${word}"的翻译`
        dictSuggestions.value = Object.keys(BUILTIN_DICT_ZH_EN)
          .filter(k => k.includes(word) || word.includes(k))
          .slice(0, 5)
      }
    } else {
      // ---- English → Chinese (dictionaryapi.dev + built-in hints) ----
      const response = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
        { signal }
      )

      if (!response.ok) {
        if (response.status === 404) {
          // Try built-in dictionary as fallback
          const zhMeaning = BUILTIN_DICT_EN_ZH[word.toLowerCase()]
          if (zhMeaning) {
            dictResult.value = {
              word,
              source: 'builtin',
              translations: [],
              entries: [{ en: word, zh: zhMeaning, pos: '' }],
            }
            saveRecentQuery(word)
            dictLoading.value = false
            return
          }
          dictError.value = `未找到"${word}"的释义`
          // Suggest similar words
          const similar = Object.keys(BUILTIN_DICT_EN_ZH)
            .filter(k => k.startsWith(word.substring(0, 3)) && k !== word)
            .slice(0, 5)
          dictSuggestions.value = similar.length > 0 ? similar : ['hello', 'world', 'good', 'time', 'people']
        } else {
          throw new Error(`请求失败 (${response.status})`)
        }
        dictLoading.value = false
        return
      }

      const data = await response.json()
      const entry = data[0]

      // Attach Chinese hints to each definition
      const meanings = entry.meanings.map((m: any) => ({
        ...m,
        definitions: m.definitions.map((d: any) => ({
          ...d,
          zhHint: getZhHint(word, d.definition),
        })),
      }))

      dictResult.value = {
        word: entry.word,
        source: 'online',
        phonetic: entry.phonetic || (entry.phonetics?.[0]?.text) || '',
        meanings,
      }
    }

    saveRecentQuery(word)
  } catch (e: any) {
    // Try built-in dictionary as fallback on network error
    const zhMeaning = BUILTIN_DICT_EN_ZH[word.toLowerCase()]
    if (zhMeaning && lang === 'en') {
      dictResult.value = {
        word,
        source: 'builtin',
        translations: [],
        entries: [{ en: word, zh: zhMeaning, pos: '' }],
      }
      dictError.value = ''
      saveRecentQuery(word)
    } else {
      dictError.value = e.message || '网络连接失败，请检查网络后重试'
    }
  } finally {
    dictLoading.value = false
  }
}

// ---- Recent queries ----
const recentQueries = ref<Array<{ word: string; timestamp: string }>>([])

function saveRecentQuery(word: string) {
  // Avoid duplicates
  recentQueries.value = recentQueries.value.filter(q => q.word.toLowerCase() !== word.toLowerCase())
  recentQueries.value.unshift({
    word,
    timestamp: dayjs().format('YYYY-MM-DD HH:mm')
  })
  if (recentQueries.value.length > 50) {
    recentQueries.value = recentQueries.value.slice(0, 50)
  }
  persistQueries()
}

function removeQuery(idx: number) {
  recentQueries.value.splice(idx, 1)
  persistQueries()
}

function clearAllQueries() {
  recentQueries.value = []
  persistQueries()
}

async function persistQueries() {
  try {
    await api.cfg.put('dict_recent', JSON.stringify(recentQueries.value))
  } catch (e) {
    logger.error('保存查询记录失败:', e)
  }
}

function reSearch(word: string) {
  activeTab.value = 'online'
  dictQuery.value = word
  lookupOnline()
}

// ---- Navigation ----
function goToBook(bookId: string, chapterIndex: number) {
  if (chapterIndex >= 0) {
    router.push({ name: 'reader', params: { id: bookId }, query: { ci: String(chapterIndex) } })
  } else {
    router.push({ name: 'reader', params: { id: bookId } })
  }
}

// ---- Utilities ----
function truncateText(text: string, maxLen: number): string {
  if (!text) return ''
  if (text.length <= maxLen) return text
  return text.substring(0, maxLen) + '...'
}

// ---- Init ----
onMounted(async () => {
  // Load recent queries
  try {
    const v = await api.cfg.get('dict_recent')
    if (v) {
      recentQueries.value = JSON.parse(v)
    }
  } catch {
    /* ignore */
  }

  // Ensure books are loaded
  if (bookshelfStore.books.length === 0) {
    await bookshelfStore.loadBooks()
  }
})
</script>

<style scoped>
.dictionary-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
}

.meaning-block {
  border-left: 3px solid var(--v-theme-surface-variant);
  padding-left: 12px;
  border-radius: 4px;
}
</style>
