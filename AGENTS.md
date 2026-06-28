# X-ReaderPlus — 开发规范与红线

> 版本 v0.4.0 | Go + Vue 3 + Vuetify 3
> 最后更新: 2026-06-28

---

## 项目定位

X-ReaderPlus 是一款 **完全脱机** 的桌面多格式电子书阅读器。

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
| 后端 | **Go** | 1.25 |
| 数据库 | **SQLite** (modernc.org/sqlite, pure Go) | — |
| 加密 | Web Crypto API + Go crypto | — |
| i18n | vue-i18n | 11.x |
| 构建 | Vite 6 | 6.x |

---

## 数据库架构

```
%APPDATA%/x-reader-plus/X-ReaderPlus/data/
├── settings.db    # config, theme, PIN, customFonts
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

| 格式 | 解析 | 状态 |
|------|------|------|
| EPUB | 前端 JSZip + DOMParser | ✅ 完整 |
| PDF | pdfjs-dist + lopdf | ✅ 完整 |
| TXT | 前端编码检测+章节拆分 | ✅ 完整 |
| Markdown | marked | ✅ 完整 |
| HTML | DOMParser | ✅ 完整 |
| FB2 | 前端 XML 解析 | ✅ 完整 |
| DJVU | 前端 TXTz 提取 + zlib 解压 | ✅ 完整 |
| DOCX/ODT/RTF | mammoth | ✅ 完整 |
| CHM | 前端 ITSF 解析 + HTML 提取 | ✅ 完整 |
| LIT | 前端 OLE2 复合文档 HTML 提取 | ✅ 完整 |
| LRF | 前端 BBeB XML 解析 | ✅ 完整 |
| CBZ/CBT | 前端 ZIP/TAR 图片提取 | ✅ 完整 |
| CBR/CB7 | 提示转换 | ⚠️ 不可用 |

> **格式白名单**：仅以上 17 种格式可导入。`ALLOWED_FORMATS` 定义于 `src/constants.ts`。

### 已禁用格式

| 格式 | 原因 |
|------|------|
| MOBI (.mobi) | HUFF/CDIC 压缩不稳定 |
| AZW3 (.azw) | 同上 |
| PRC (.prc) | 同上 |
| PDB (.pdb) | 同上 |

> **转换方法**: 使用 [Calibre](https://calibre-ebook.com) 将上述格式转为 EPUB 后导入。

---

## 构建命令

```bash
# 前端开发
npm run dev

# Go 后端开发
cd backend && go run .

# 生产构建（前端嵌入 Go 二进制，单文件发布）
npm run build:all     # vite build + 复制前端到 backend/frontend/ + go build
npm run build:go      # 仅 Go 构建（需先 npm run build）

# 禁用 WebView 调试模式
$env:XREADER_NO_WEBVIEW="1"; cd backend; go run .
```

---

## 文件结构

```
X-ReaderPlus/
├── src/                          # Vue 3 前端
│   ├── views/                    # 页面视图 (11 个，专注模式为 ReaderView 内状态)
│   ├── stores/                   # Pinia 状态管理 (5 个)
│   ├── services/                 # 业务逻辑 + api-bridge.ts + 格式解析器
│   ├── composables/              # 可复用组合函数
│   ├── plugins/                  # Vuetify / i18n 插件
│   ├── locales/                  # 国际化 (zh-CN / en-US)
│   ├── router/                   # Vue Router
│   ├── types/                    # TypeScript 类型声明
│   ├── App.vue                   # 根组件（含自定义标题栏）
│   ├── main.ts                   # 入口
│   ├── style.css                 # 全局样式
│   └── constants.ts              # 常量定义 + 格式白名单
├── backend/                      # Go 后端
│   ├── main.go                   # 入口：embed 前端 + HTTP 服务 + API
│   ├── types.go                  # 共享类型定义
│   ├── webview_windows.go        # Windows: go-webview2 无边框窗口
│   ├── webview_darwin.go         # macOS: webview_go Cocoa 原生窗口
│   ├── webview_darwin_headless.go # macOS: CGO 禁用降级模式
│   ├── webview_linux.go          # Linux: webview_go GTK 原生窗口
│   ├── webview_linux_headless.go # Linux: CGO 禁用降级模式
│   ├── webview_other.go          # 其他平台降级模式
│   ├── frontend/                 # 构建时由 copy-frontend.js 填充（gitignored）
│   │   └── .gitkeep
│   ├── db/                       # 数据库初始化 + schema
│   ├── api/                      # REST handlers (17 端点)
│   └── go.mod / go.sum
├── scripts/
│   ├── copy-frontend.js          # 复制 dist/ → backend/frontend/
│   ├── installer.nsi             # NSIS Windows 安装程序脚本
│   ├── build-macos.sh            # macOS .app + .dmg 打包
│   └── build-linux.sh            # Linux AppImage 打包
├── public/
│   └── icon.svg
├── .github/workflows/
│   ├── build.yml                 # 全平台 CI 构建+打包
│   └── release.yml               # 自动 Release 发布
├── package.json                  # v0.3.1
├── vite.config.ts
└── index.html
```

---

## 限制

### 格式与文件
| 限制 | 值 | 说明 |
|------|-----|------|
| MOBI/AZW3/PRC/PDB | 已禁用 | 需用 Calibre 转 EPUB |
| CBR/CB7 | 不可解析 | RAR/7z 为专有闭源格式 |
| EPUB DRM | 不支持 | 加密 EPUB 无法解析 |
| 文件大小 | 单文件最大 **500 MB** | 超过拒绝导入 |
| EPUB 文件数 | 最多 **10000** 个文件 | 超过拒绝解析 |
| EPUB 嵌入图片 | 单张最大 **2 MB** | 超过保留原始路径 |
| EPUB 封面图片 | 最大 **5 MB** | 超过跳过 |
| PDF 最大页数 | **500** 页 | 超过截断 |
| PDF 大文件警告 | 超过 **100 MB** | 渲染可能较慢 |
| 漫画页数 (CBZ) | 最多 **50** 页 | ZIP 图片数上限 |
| 漫画页数 (CBT) | 最多 **200** 页 | TAR 图片数上限 |
| 漫画单张图片 | 最大 **10 MB** | 超过跳过 |
| 封面缩略图 | **200×300 px**, 质量 0.6 | 最小压缩 10 KB |
| 阅读历史记录 | 最多 **500** 条 | 超过自动删除最早 |
| 阅读统计 | 最近 **365** 天 | 自动清理旧数据 |

### 阅读与 UI
| 限制 | 值 | 说明 |
|------|-----|------|
| 字体上传 | 最大 **10 MB** | .ttf/.otf/.woff/.woff2 |
| 自动标签检测 | 最多 **10** 个/书 | 扫描前 100 行 |
| 标签长度 | **1-30** 字符 | 低于/超过不自动检测 |
| 章节标题截断 | **80** 字符 | 超过截断为 77 + "..." |
| 阅读器最大宽度 | **900** px | — |
| 解析 Worker 超时 | **30** 秒 | 超时抛出错误 |
| 章节内容警告 | JSON **> 5 MB** | 日志警告 |
| 手动翻页自动滚屏暂停 | — | 用户操作时暂停 |

### 安全
| 限制 | 值 | 说明 |
|------|-----|------|
| 外部链接 | ShellExecute 打开默认浏览器 | 仅 Windows 支持 |
| 服务绑定 | **127.0.0.1** 仅本机 | 不接受外部连接 |
| PIN PBKDF2 | **60 万** 迭代 | 密钥派生 |
| PIN 阶梯锁定 | **5 次 → 30s** / **15 次 → 5min** | 递增惩罚 |
| 隐私锁密码 | 最低 **8 字符** | 大小写 + 数字 |
| 加密 | **AES-256-GCM** | 数据库 + WebDAV |
| 安全盐 | **32** 字节 | PIN/密码哈希 |
| AES IV | **12** 字节 | 加密初始化向量 |
| HTML 输出 | DOMPurify 白名单 | 仅允许安全标签和属性 |
| Style url() | 全部替换为 `none` | 防止数据泄露 |
| on* 事件 | 全部移除 | 防 XSS |
| javascript: URI | 替换为 `blocked:` | 防 XSS |

### 后端
| 限制 | 值 | 说明 |
|------|-----|------|
| SQLite 连接池 | 最多 **1** (WAL 模式) | 单写确保数据完整 |
| SQLite 忙等超时 | **5** 秒 | 锁等待 |
| HTTP 关闭宽限期 | **2** 秒 | 优雅关闭 |
| WebView 启动重试 | **200** 次 × 50ms = **10** 秒 | electronAPI 桥接超时 |
| 默认窗口大小 | **1280×800** px | — |

---

## 相关文档

- [README](README.md) — 项目介绍
- [CONTRIBUTING](CONTRIBUTING.md) — 贡献指南
- [SECURITY](SECURITY.md) — 安全策略
- [ROADMAP](ROADMAP.md) — 路线图

---

## 阅读模式架构

```
ReaderView.vue 工具栏 v-btn-toggle:
  📋 滚动阅读 (scroll)    — 默认模式，自由滚动
  📖 翻页阅读 (pagination) — overflow:hidden, 点击/←→ 翻页
  ▶ 自动滚屏 (auto)        — setInterval 逐帧滚动
```

### 翻页模式
- `paginateChapter()` 测量内容高度并切分为页
- `scrollToCurrentPage()` 计算累计偏移并 scrollTo
- 点击区域: 左 25% 上一页, 右 25% 下一页
- 键盘: `←` / `→`, `PageUp` / `PageDown`

### 专注模式
- `focus-spotlight` — 全屏固定暗化遮罩
- 所有块级元素 `opacity: 0.22`
- 视口中心最近元素: `opacity: 1` + `font-weight: 700` + `box-shadow` 辉光
- `onFocusScroll()` RAF 节流实时跟踪

### 自定义字体
- `SettingsView` 上传按钮 → `arrayBufferToBase64`
- `addCustomFont({ name, family, dataUrl, format })` 持久化
- `injectFontFace()` 注入 `<style id="font-{family}">`
- `onMounted` 时恢复所有已安装字体
