# X-ReaderPlus — 开发规范与红线

> 版本 v0.3.0 | Go + Vue 3 + Vuetify 3
> 最后更新: 2026-06-27

---

## 项目定位

X-ReaderPlus 是一个 **完全脱机** 的桌面多格式电子书阅读器。

- **仓库**: github.com/stop666two/X-ReaderPlus
- **作者**: stop666
- **开源协议**: MIT
- **红线**: **严禁倒卖**

---

## 核心原则（不可违背）

### 1. 完全脱机
- 除词典 API 外，**禁止任何网络请求**
- 所有数据存储在本地
- 不得收集用户数据、不上传、不追踪

### 2. 隐私至上
- 所有书籍和阅读数据仅存储在本地
- 数据库加密可选（AES-256-GCM + PBKDF2 60万次）
- PIN 锁保护应用入口

### 3. 数据本地
- **唯一数据源: SQLite** (`%APPDATA%/x-reader-plus/X-ReaderPlus/data/`)
- 3 数据库分离: `settings.db` / `content.db` / `meta.db`
- 不允许 IndexedDB 做主存储

### 4. 简洁实用
- 不追求花哨功能
- 阅读体验优先
- 性能至上

---

## 技术栈（锁定）

| 层 | 技术 | 版本 |
|---|------|------|
| 前端 | Vue 3 (Composition API) | 3.5 |
| UI | Vuetify 3 (Material Design 3) | 3.x |
| 状态 | Pinia | 3.x |
| HTTP | Fetch API (无框架依赖) | — |
| 后端 | **Go** | 1.26 |
| 数据库 | **SQLite** (modernc.org/sqlite, pure Go) | — |
| 加密 | Web Crypto API + Go crypto | — |
| i18n | vue-i18n | 11.x |
| 构建 | Vite 6 | 6.x |

---

## 数据库架构

```
%APPDATA%/x-reader-plus/X-ReaderPlus/data/
├── settings.db    # config, theme, PIN
├── content.db     # chapters, raw_files
└── meta.db        # books, bookmarks, annotations, trash, libraries, history, stats
```

---

## 数据流

```
Vue 3 前端 → fetch() HTTP → Go REST API → modernc.org/sqlite → SQLite
```

---

## REST API

| 方法 | 路径 | 用途 |
|------|------|------|
| GET/POST | `/api/books` | 书籍 CRUD |
| GET/PUT/DELETE | `/api/books/{id}` | 单本书操作 |
| GET | `/api/books/count` | 书籍数量 |
| GET/POST/DELETE | `/api/chapters/{bookId}` | 章节管理 |
| GET/POST/DELETE | `/api/config/{key}` | 配置管理 |
| POST | `/api/config` | 批量配置保存 |
| GET/POST | `/api/bookmarks` | 书签 |
| GET/POST | `/api/annotations` | 标注 |
| GET/POST/DELETE | `/api/trash` | 回收站 |
| GET/POST | `/api/libraries` | 书库 |
| GET/POST | `/api/theme` | 主题 |
| GET/POST | `/api/settings` | 设置 |
| GET/POST | `/api/history` | 阅读历史 |
| GET/POST | `/api/stats` | 阅读统计 |
| GET | `/api/search?q=` | 搜索 |
| GET/POST/DELETE | `/api/raw/{bookId}` | 原始文件 |
| DELETE | `/api/clear` | 清空数据 |

---

## 格式支持

| 格式 | 解析 | 
|------|------|
| EPUB | 前端 JSZip + DOMParser |
| MOBI/AZW3 | 前端解析 |
| PDF | pdfjs-dist + lopdf |
| TXT | 前端编码检测+章节拆分 |
| Markdown | marked |
| HTML | DOMParser |
| FB2 | 前端 XML 解析 |
| DJVU | 前端解析 |
| DOCX/ODT | mammoth |
| CBZ/CBT | 前端 ZIP/TAR 图片提取 |

---

## 构建命令

```bash
# 前端开发
npm run dev

# Go 后端开发
cd backend && go run .

# 生产构建
npm run build        # Vite 前端
cd backend && go build -ldflags="-s -w" -o dist/x-reader.exe .
```

---

## 文件结构

```
X-ReaderPlus/
├── src/                          # Vue 3 前端
│   ├── views/                    # 页面视图
│   ├── stores/                   # Pinia
│   ├── services/                 # 业务逻辑 + api-bridge.ts
│   ├── components/               # 组件
│   └── main.ts                   # 入口
├── backend/                      # Go 后端
│   ├── main.go
│   ├── db/                       # 数据库初始化 + schema
│   ├── api/                      # REST handlers
│   └── go.mod / go.sum
├── package.json                  # v0.3.0
├── vite.config.ts
└── index.html
```

---

## 相关文档

- [README](README.md) — 项目介绍
- [CONTRIBUTING](CONTRIBUTING.md) — 贡献指南
- [SECURITY](SECURITY.md) — 安全策略
- [ROADMAP](ROADMAP.md) — 路线图
