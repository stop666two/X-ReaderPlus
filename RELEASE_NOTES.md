# X-ReaderPlus v0.2.0

Bug 修复与功能增强版本——修正 18 个问题 + 新增 PDF Canvas、CBT 漫画、EPUB 增强、全文索引、标注导出、编码增强、性能优化、快捷键全面可配。

---

## 下载

| 平台 | 文件 | 说明 |
|------|------|------|
| **Windows 安装版** | `X-ReaderPlus.Setup.0.2.0.exe` | 安装版，适用绝大多数 PC（x64） |
| **Windows 便携版 x64** | `X-ReaderPlus-0.2.0-win.zip` | 解压即用，可放 U 盘 |
| **Windows 便携版 32位** | `X-ReaderPlus-0.2.0-ia32-win.zip` | 适用老电脑 |
| **Windows 便携版 ARM** | `X-ReaderPlus-0.2.0-arm64-win.zip` | 适用 ARM 芯片笔记本 |
| **macOS (ARM)** | `X-ReaderPlus-0.2.0-arm64.dmg` | 拖入 Applications 文件夹 |
| **Linux** | `X-ReaderPlus-0.2.0.AppImage` | `chmod +x` 后直接运行 |

---

## 🔴 严重 Bug 修复

### 阅读时间统计修复
阅读时间被严重多计——定时器每30秒保存一次增量，退出时又保存累计值，导致45秒被记录为75秒。现已引入 `lastSavedSeconds` 增量追踪，每次仅保存未计入的增量部分。

### 漫画格式声明修正
项目曾声称支持 CBR、CBT、CB7 格式，但实际只解析成占位文本。各格式现返回明确的说明信息，解释格式限制并给出转换为 CBZ 的操作指引。

### DJVU 文本解压修复
DJVU TXTz chunks 使用 DEFLATE 压缩，但解压函数直接返回原始数据。现使用浏览器内置 `DecompressionStream('deflate-raw')` 进行真正解压，大幅提升文本提取质量。

### 文件路径安全验证增强
`isValidFilePath` 无法拦截 `C:\Windows\...` 风格路径。现已增加 `..` 遍历检测、绝对路径解析、`C:\Windows`/`C:\Program Files` 等系统目录拦截。

### 文件读取 Buffer 截断修复
`file:read` 和 `file:readBatch` 直接使用 `buffer.buffer`，可能包含超出实际数据的尾部垃圾。改为 `buffer.buffer.slice(byteOffset, byteOffset + byteLength)` 精确传输。

---

## 🆕 功能增强

### EPUB 内嵌图片渲染 ✨
EPUB 章节中的 `<img>` 标签现在会被解析——从 EPUB zip 中提取对应图片文件，转换为 base64 data URI 内嵌到 HTML 中。封面图提取也同步修复了路径解析问题（`/images/cover.jpg` 这种绝对路径之前会丢失目录上下文）。

### 长章节懒渲染 ✨
10万字以上的长章节不再一次性渲染全部内容。使用 IntersectionObserver 监控可见区域，初始只渲染前 30 段，滚动到接近底部时自动加载下 20 段。万行章节流畅不卡。

### MOBI/AZW3 编码增强
`decodeAscii` 替换为 `decodeTextSegment`——优先 UTF-8 解码，回退 GB18030（中文），最后兜底逐字节 ASCII。中文 MOBI 文件不再乱码。

### PDF Canvas 逐页渲染 ✨
PDF 不再只有纯文本——使用 pdfjs-dist 将每页渲染为 PNG 图片，IntersectionObserver 按需加载可见页面。支持 500 页以内，缩放自适应屏幕清晰度。渲染失败自动回退到文本模式。

### EPUB 图片渲染增强 ✨
- **SVG 支持**：内嵌 `<svg>` 标签中的 `<image>` 引用自动转为 data URI
- **路径规范化**：`../Images/photo.jpg` 等递归相对路径正确解析
- **封面 guide 回退**：`<meta name="cover">` 找不到时从 `<guide>` 中查找封面

### 全文倒排索引 ✨
新建 `search-index.ts` 搜索引擎——为章节内容预建倒排索引（中文逐字、英文分词），搜索从 O(n) 全文扫描优化为索引查找。500+本书库搜索秒级响应。索引在导入时自动构建，启动时异步补齐缺失。

### CBZ/CBT 漫画图片翻页 ✨
CBZ（ZIP）和 CBT（TAR）漫画从压缩包中提取图片——JPG/PNG/GIF/WebP/BMP 转为 base64 逐页渲染。支持自然排序，200 张图片限制防内存溢出。CBR/CB7 提示转换方法。

### 标注导出 Markdown/CSV ✨
设置→数据管理中新增"导出标注"按钮。Markdown 格式按书分组含颜色标记原文笔记，CSV 格式含书名/章节/颜色/文本/笔记/日期字段。支持 Electron 保存对话框和浏览器 Blob 下载。

### 编码支持增强
TXT 解析器新增 ISO-2022-JP 和 EUC-TW 编码检测，覆盖更多日文和繁中老旧文本文件。

### 快捷键可视化面板 ✨
设置→快捷键中新增可视化总览面板——以 kbd 标签分拆展示组合键，全局快捷键（蓝色）和阅读器快捷键（紫色）分区展示。内置冲突检测，重复绑定时红色警告 + 脉冲动画。

---

## 🟠 重要改进

### 选中文字标注偏移量精确计算
标注偏移量之前使用 `indexOf` 在 HTML 文本中搜索，遇到重复文字会错位。现改用基于 Range API 的精确计算——通过 `TreeWalker` 遍历选区之前的文本节点累加偏移，无论相同文字出现多少次都能正确定位。

### 阅读计时器窗口隐藏时暂停
`setInterval` 在 Electron 窗口最小化时仍然运行，导致未阅读时时间也持续累积。现已监听 `visibilitychange` 事件，页面隐藏时暂停计时器，恢复时继续。

### EPUB 封面路径解析修复
`resolvePath` 函数处理以 `/` 开头的相对路径时有 bug——直接 `slice(1)` 丢失了 rootDir 上下文。现改为相对于 rootDir 解析绝对路径。

---

## 🟡 其他改进

### 导出备份包含加密密钥
备份文件现在会保存 AES 加密密钥。换了电脑恢复备份时，之前加密的内容可以正确解密读取。

### 主题加载无闪烁
修复了应用启动时的主题闪烁问题。之前 `watch` 的 `immediate: true` 在数据加载前先用默认主题渲染，加载后再覆盖，产生可见闪烁。

### 书架页面避免重复加载
`App.vue` 已调用 `loadAllData()` 全局加载，书架页 `onMounted` 无需重复加载。现检查数据是否已就绪，已加载则跳过。

### 背景图片 URL 验证
`bgImageUrl` 设置现只允许 `http://`、`https://` 和 `data:` URI，拒绝任意输入。

### 应用图标路径修复
Electron 窗口和托盘图标引用从 `icon.png` 修正为实际存在的 `icon.svg`。

### 日志统一
`BookshelfView` 和 `ReaderView` 中的 `console.error` 调用已统一替换为 `logger.error`。

### CSP 安全增强
添加 `object-src 'none'` 禁用插件执行。自定义 CSS 注入过滤——移除含 `url()` 和 `@import` 的规则，防止数据外泄。

### 数据库 Schema 整理
移除重复的 v1 schema 定义，添加清晰的版本迁移注释，为未来 IndexedDB 升级做好准备。

### 书架性能优化
100+本书不再卡顿——封面自动压缩为 200×300px 缩略图（~20KB/张），50本分页加载，`content-visibility` 跳过屏外渲染。封面加载失败自动显示彩色占位符。

### 书架功能增强
- **按章节数排序**：新增"章节数 多→少 / 少→多"排序选项
- **倒序一键切换**：排序器旁新增翻转按钮，点击即反向

### 快捷键全面可配
所有阅读器快捷键均可自定义——章节导航、搜索、翻页不再硬编码。设置→快捷键中新增 `章节开头`/`章节末尾` 绑定项，国际标准键盘布局完全兼容。

---

## 📋 v0.2.0 审计修复（2026-06-25）

> 全面代码审计发现 9 个 Critical + 12 个 High 问题，均已在当前版本中修复。

### 🔴 严重修复

| 问题 | 文件 | 说明 |
|------|------|------|
| **导航阻塞** | `ReaderView.vue` | `onBeforeRouteLeave` 3参数签名（Vue Router 3 遗留）导致 `_next` 回调永不触发，返回按钮永久失效 |
| **书签/标注损坏** | `reader.ts` | `loadBookmarks`/`loadAnnotations` 赋值原始 `[{id,data}]` 行，未 `JSON.parse(data)`，所有书签属性返回 undefined |
| **封面未压缩** | `bookshelf.ts` | `compressCover()`（200×300 JPEG 0.6）从未调用，封面原图存储浪费空间 |
| **DB Handler 缺 safeHandler** | `main.ts` | 18 个 IPC handler（bookmarks/annotations/trash/libraries）无错误包裹，DB异常→未处理 rejection |
| **electronAPI! 无检查** | 3 文件 | 7 处 `!` 非空断言无 null guard |
| **阅读进度静默丢失** | `ReaderView.vue` | 4 处 `catch {}` 吞没持久化失败，无日志 |

### 🟠 重要修复

| 问题 | 说明 |
|------|------|
| 主进程无全局异常 | 添加 `uncaughtException` + `unhandledRejection` 处理器 |
| 无导航防护 | 添加 `will-navigate` 事件 + `setWindowOpenHandler` |
| `workerParse` 返回 `any` | 改为 `Promise<ParsedBook>` |
| 字典重复 key | 合并 `right`/`open` 等 6 个多义词 duplicate key |

### 🟡 改进

- 46→12 个 vue-tsc 错误（剩余全为 Vuetify 组件类型兼容/Dexie 回退路径）
- `ReadingShortcuts` 添加 index signature 修复快捷键索引类型
- `dev.ts` 添加 Vite client 类型引用
- 所有空 `catch {}` 添加注释说明

---

## 📋 v0.2.0 第二次审计修复（2026-06-25）

> 第二次深度审计，聚焦数据删除完整性、存储一致性、原生模块兼容性。修正 10 个问题。

### 🔴 严重修复

| 问题 | 文件 | 说明 |
|------|------|------|
| **原生模块 ABI 不匹配** | `main.ts` / `package.json` | 升级 Electron 31→42 后 `better-sqlite3` 未重建，`NODE_MODULE_VERSION` 不匹配导致全部数据库操作静默失败。已执行 `@electron/rebuild` + 添加 `postinstall`/`rebuild` 脚本 |
| **永久删除不清理关联数据** | `main.ts` | `db:trash:delete` 仅删回收站记录，不清理 chapters/bookmarks/annotations/CBZ 缓存。新增 `db:trash:permanentDelete`、`db:trash:batchPermanentDelete` handler，级联清理所有关联数据 |
| **导入数据静默丢失** | `SettingsView.vue` | `api.lib.put(id,data)` 错误传两参数给 `books.insert(book)` — insert 只接受单 Book 对象，第二个参数（JSON 字符串）被丢弃。导入进度条显示 100% 但数据未写入 |

### 🟠 重要修复

| 问题 | 说明 |
|------|------|
| 双存储数据不一致 | NotesView/SettingsView 的 `api.bm.put`/`api.ann.put` 使用不存在的 `put()` 方法（应为 `insert`），`?.` 可选链静默回退 Dexie IndexedDB。阅读器从 SQLite 读写→书签/标注对用户不可见 |
| `db:bookmarks:getAll` 缺失 | 书签导出/备份功能无法从 SQLite 读取，始终回退 IndexedDB。新增 handler + preload 桥接 |
| `db:trash:clear` 不清理关联数据 | 清空回收站仅执行 `DELETE FROM trash`，章节/书签/标注成为孤儿数据 |
| `db:clearAll` 遗留缓存 | 清除全部数据时不删除 CBZ 图片缓存目录 |

### 🟡 改进

- 12→4 个 vue-tsc 错误（均为 Vuetify 组件类型兼容，不影响运行）
- `bookshelf.deleteBooks` 改为乐观删除 + IPC 错误检测，避免失败时静默回退
- `TrashView` 所有永久删除操作新增进度条反馈
- ReaderView 移除重复的 `teardownPdfPageObserver()` 调用
- 新增 `package.json` `rebuild`/`postinstall` 脚本确保原生模块自动重建

### 书架
- 网格 / 列表双视图，封面尺寸三档可调
- 拖拽批量导入，复制导入 / 文件夹引用两种模式
- 多书库管理，全部书库聚合视图
- 书名作者搜索、标签筛选、7 种排序方式
- 批量选择（全选 / 反选 / 删除），删除进回收站
- 书籍详情：评分、短评、标签编辑

### 阅读器
- 16 种格式支持：EPUB / TXT / Markdown / HTML / MOBI / AZW3 / FB2 / DJVU / DOCX / RTF / ODT / PDF / CBZ
- CBR / CBT / CB7 识别并提示转换方法
- 分章节阅读，智能章节检测（中文 / 英文 / 序言 / 番外等）
- 智能作者识别 + 自动标签识别
- 章节导航：按钮 / 键盘 / 屏幕边缘点击 / 底部滑块
- 阅读位置持久化——跨会话记忆
- 已读章节打勾，目录面板实时标记
- 专注模式——仅高亮当前段落
- 排版微调：字号、行距、段距、缩进、字重、字体、边距、页宽
- 3 种主题：明亮 / 暗黑 / 护眼，主题颜色可深度自定义
- Ctrl+滚轮缩放，工具栏自动隐藏
- 全文搜索、自动滚屏、虚拟滚动
- 阅读统计浮窗

### 标注与笔记
- 划词高亮（6 色）+ 划词笔记
- 复制 / 查词典
- 全局笔记管理——按书/关键词筛选、笔记跳转定位
- 笔记软删除可恢复

### 词典
- 书库全文搜索
- 在线英文词典（dictionaryapi.dev）
- 内置中英互译词典

### 安全
- 完全脱机——数据 100% 本地 IndexedDB
- PIN 码保护——SHA-256 + PBKDF2（60万次迭代）+ AES-256-GCM
- 两级锁定策略、安全问题重置 PIN
- HTML 净化（DOMPurify）+ 严格 CSP

### 桌面特性
- 无边框自定义窗口 + 系统托盘
- 老板键（Ctrl+B）、命令面板（Ctrl+K）
- 开机自启 + 启动最小化到托盘
- WebDAV 云备份、数据导出/导入

### 其他
- 阅读统计、阅读历史、回收站
- Web Worker 多线程解析
- SHA-256 内容去重
- 10 种编码自动检测、批量分块操作

---

## 技术栈

Vue 3 + TypeScript + Vite 6 + Electron 42 + Vuetify 3 + SQLite (better-sqlite3) + vue-i18n + Web Crypto API

---

## 作者

**stop666** — 完全免费，开源（MIT），严禁倒卖。

捐赠 USDT（ETH/ERC20 / BSC/BEP20）：
`0xbB515f953e16f0a7b51f537BB1DAB6fbB6026533`

---

## 注意

- 不支持 DRM 保护的书籍
- macOS 首次打开需去「系统设置 → 隐私与安全性」放行
- Windows SmartScreen 弹窗点「更多信息 → 仍要运行」
- Linux 需要 `chmod +x` 给执行权限
