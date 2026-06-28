# X-ReaderPlus

<div align="center">

**完全脱机 · 隐私至上 · 多格式 · 高性能**

[![Build](https://github.com/stop666two/X-ReaderPlus/actions/workflows/build.yml/badge.svg)](https://github.com/stop666two/X-ReaderPlus/actions/workflows/build.yml)
[![Version](https://img.shields.io/badge/version-0.3.1-blue)](https://github.com/stop666two/X-ReaderPlus/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.25+-00ADD8?logo=go)](https://go.dev)
[![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js)](https://vuejs.org)

[快速开始](#快速开始) · [架构](#架构) · [文档](#文档) · [捐赠](#捐赠)

</div>

---

## 简介

X-ReaderPlus 是一款**完全脱机**的桌面多格式电子书阅读器。不依赖网络、不收集数据、不上传文件。所有数据加密存储在本地 SQLite 中。

### 为什么选择 X-ReaderPlus？

| 特性 | 说明 |
|------|------|
| 🔒 **完全脱机** | 除词典 API 外零网络请求，断网环境完美运行 |
| 🛡️ **隐私至上** | 3 数据库分离存储，AES-256-GCM 加密可选，PIN 锁保护 — [安全策略](SECURITY.md) |
| 📚 **17 种格式** | EPUB, PDF, TXT, FB2, DJVU, CHM, LIT, LRF, DOCX, RTF, ODT, Markdown, HTML, CBZ, CBR, CBT, CB7 |
| ⚡ **极速编译** | Go 后端编译 <1 分钟，二进制 ~18 MB |
| 🎨 **Material Design 3** | Vuetify 3 组件，亮色/暗色/护眼三主题 |
| 📖 **三阅读模式** | 滚动 / 翻页（点击+键盘←→） / 自动滚屏（可调速度） |
| 🔍 **全文搜索** | 跨书籍全文索引搜索，支持中文分词 |
| 📝 **标注系统** | 6 色高亮/下划线/笔记 |
| 🔖 **书签管理** | 跨章节书签，快速跳转 |
| 🗑️ **回收站** | 删除保护，误删可恢复 |
| 📊 **阅读统计** | 阅读时间、字数、进度全追踪 |
| ☁️ **WebDAV 备份** | AES-256-GCM 端到端加密备份，换设备无缝恢复 |
| 🎯 **专注模式** | 全屏暗化遮罩 + 聚焦段落加粗阴影辉光，随滚动实时切换 |
| ✍️ **自定义字体** | 上传 .ttf/.otf/.woff/.woff2，自动注入 @font-face |

---

## 格式支持

| 格式 | 状态 | 说明 |
|------|------|------|
| EPUB (.epub) | ✅ 完整 | 支持 NCX/EPUB3 目录、图片嵌入、CSS |
| PDF (.pdf) | ✅ 完整 | pdfjs-dist 渲染，支持缩放 |
| TXT (.txt) | ✅ 完整 | 自动编码检测，智能章节拆分 |
| FB2 (.fb2) | ✅ 完整 | FictionBook XML 解析 |
| DJVU (.djvu) | ✅ 完整 | TXTz 提取 + DEFLATE 解压 |
| Markdown (.md) | ✅ 完整 | marked 渲染 |
| HTML (.html/.htm) | ✅ 完整 | DOMParser 解析 |
| DOCX (.docx) | ✅ 完整 | mammoth 转换 |
| RTF (.rtf) | ✅ 完整 | mammoth 转换 |
| ODT (.odt) | ✅ 完整 | mammoth 转换 |
| CHM (.chm) | ✅ 完整 | ITSF 格式 HTML 提取 |
| LIT (.lit) | ✅ 完整 | OLE2 复合文档 HTML 提取 |
| LRF (.lrf) | ✅ 完整 | BBeB XML 解析 |
| CBZ (.cbz) | ✅ 完整 | ZIP 图片提取，最大 200 页 |
| CBT (.cbt) | ✅ 完整 | TAR 图片提取，最大 200 页 |
| CBR (.cbr) | ⚠️ 不可用 | RAR 专有格式，浏览器端无法解压 — 请转为 CBZ 后导入 |
| CB7 (.cb7) | ⚠️ 不可用 | 7z 专有格式 — 请转为 CBZ 后导入 |

### 已禁用格式

> **MOBI / AZW3 / PRC / PDB** 因解析不稳定已从白名单移除。请使用 Calibre 转为 EPUB 后导入。

---

## 限制

### 格式与文件
| 限制 | 值 | 说明 |
|------|-----|------|
| 单文件最大 | **500 MB** | 超过此大小的文件将被拒绝导入 |
| EPUB 内文件数 | **10000** 个 | 超过将拒绝解析 |
| EPUB 嵌入图片 | **2 MB** / 张 | 超过的图片保留原始路径，不转 data URI |
| EPUB 封面图片 | **5 MB** | 超过的封面将被跳过 |
| PDF 最大页数 | **500** 页 | 超过将截断，仅渲染前 500 页 |
| PDF 大文件警告 | **100 MB** | 超过 100 MB 的 PDF 渲染可能较慢 |
| 漫画页数上限 (CBZ) | **50** 页 | ZIP 漫画图片数上限 |
| 漫画页数上限 (CBT) | **200** 页 | TAR 漫画图片数上限 |
| 漫画单张图片 | **10 MB** | 超过的图片将被跳过 |
| MOBI/AZW3/PRC/PDB | 已禁用 | 需用 Calibre 转为 EPUB |
| CBR/CB7 | 不可解析 | RAR/7z 为专有闭源格式，请转为 CBZ |
| EPUB DRM | 不支持 | 加密 EPUB 无法解析 |

### 阅读与显示
| 限制 | 值 | 说明 |
|------|-----|------|
| 自定义字体大小 | **10 MB** / 个 | .ttf/.otf/.woff/.woff2 |
| 封面缩略图 | **200×300 px** | JPEG 质量 60% |
| 阅读历史记录 | **500** 条 | 超过自动删除最早的 |
| 阅读统计 | **365** 天 | 仅保留最近一年 |
| PDF 文本选择 | 有限 | 后续版本改进 |
| 自动标签检测 | **10** 个 | 每本书最多自动检测 10 个标签 |
| 章节标题截断 | **80** 字符 | 超过的标题截断为 77 字符 + "..." |

### 安全与隐私
| 限制 | 值 | 说明 |
|------|-----|------|
| PIN 锁尝试 | **5 次 → 30 秒锁** / **15 次 → 5 分钟锁** | 阶梯式锁定 |
| 隐私锁密码 | 最低 **8 字符** | 必须含大小写字母 + 数字 |
| PBKDF2 迭代 | **60 万次** | 用于 PIN 哈希和密钥派生 |
| 加密算法 | **AES-256-GCM** | 数据库加密和 WebDAV 备份加密 |
| 服务绑定 | **127.0.0.1** 仅本机 | 不接受外部连接 |
| 网络访问 | 无（除词典 API） | 完全脱机运行 |

### HTML 渲染安全
| 规则 | 说明 |
|------|------|
| 允许的标签 | h1-h6, p, br, hr, b, i, em, strong, u, s, mark, small, sub, sup, ul, ol, li, blockquote, pre, code, a, img, span, div, table 系列, figure, figcaption |
| 允许的属性 | href, src, alt, title, class, id, width, height, style, data-*, colspan, rowspan |
| 禁止协议 | `javascript:` 替换为 `blocked:`，只允许 http/https/mailto/tel |
| 禁止元素 | script, style, svg, iframe, object, embed, link, meta, base, form |
| 禁止事件 | 所有 `on*` 事件处理器被移除 |
| inline style url | 所有 `url(...)` 替换为 `none` |

---

## 快速开始

### 下载安装

访问 [Releases](https://github.com/stop666two/X-ReaderPlus/releases) 下载对应平台版本：

| 你的电脑 | 下载 |
|----------|------|
| 🪟 Windows x64 | `X-ReaderPlus-Setup-x64.exe` (安装程序) |
| 🪟 Windows x86 | `X-ReaderPlus-win-x86.exe` |
| 🪟 Windows ARM | `X-ReaderPlus-win-arm64.exe` |
| 🍎 Mac Intel | `X-ReaderPlus-mac-intel.dmg` |
| 🍎 Mac Apple Silicon | `X-ReaderPlus-mac-apple.dmg` |
| 🐧 Linux x86_64 | `X-ReaderPlus-linux-amd64.AppImage` |
| 🐧 Linux ARM64 | `X-ReaderPlus-linux-arm64.AppImage` |

> **Windows 推荐**下载 Setup 安装程序，带开始菜单/桌面快捷方式/卸载程序。
> **Mac** 打开 dmg 拖入 Applications。**Linux** `chmod +x *.AppImage` 后直接运行。

### 开发构建

```bash
git clone https://github.com/stop666two/X-ReaderPlus.git
cd X-ReaderPlus
npm install

# 终端1: 前端 (http://localhost:5173)
npm run dev

# 终端2: 后端 (http://127.0.0.1:34123)
npm run dev:go

# 生产构建 (单文件 exe，前端嵌入 Go 二进制)
npm run build:all     # vite build + 复制前端 + go build
npm run build:go      # 仅 Go 构建 (需先 npm run build)
```

---

## 文档

| 文档 | 说明 |
|------|------|
| [AGENTS.md](AGENTS.md) | 开发规范与红线 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 贡献指南 |
| [SECURITY.md](SECURITY.md) | 安全策略 |
| [ROADMAP.md](ROADMAP.md) | 路线图 |

---

## 架构

```
开发: Vue 3 (Vite :5173) ──fetch──→ Go (net/http :34123) ──→ SQLite × 3
发布: Vue 3 静态文件嵌入 Go 二进制 → :34123                     settings/content/meta
```

| 层 | 技术 |
|---|------|
| 前端 | Vue 3.5 + Vuetify 3 + Pinia 3 |
| 后端 | Go 1.25 + modernc.org/sqlite |
| 桌面壳 | WebView2 (Win) / WebKit (Mac) / GTK (Linux) |

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+F` | 搜索 |
| `Ctrl+B` | 书签 |
| `Ctrl+Shift+F` | 专注模式 |
| `←` / `→` | 翻页模式：上/下页 |
| `PageUp` / `PageDown` | 翻页模式：上/下页；滚动模式：滚动一屏 |
| `Space` | 下一页/向下滚动 |
| `Esc` | 关闭弹窗/返回 |

---

## 捐赠

本软件完全免费开源。如果你觉得有用，欢迎捐赠支持开发。

```
USDT (ETH/ERC20 & BSC/BEP20):
0xbB515f953e16f0a7b51f537BB1DAB6fbB6026533
```

**严禁倒卖。** 本软件及其衍生作品不得以任何形式出售。

---

## 协议

MIT License © 2026 stop666. 详见 [LICENSE](LICENSE).
