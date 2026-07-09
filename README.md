# X-ReaderPlus

<div align="center">

**完全脱机 · 隐私至上 · 多格式 · 高性能**

[![Build](https://github.com/stop666two/X-ReaderPlus/actions/workflows/build.yml/badge.svg)](https://github.com/stop666two/X-ReaderPlus/actions/workflows/build.yml)
[![Version](https://img.shields.io/badge/version-0.4.1-blue)](https://github.com/stop666two/X-ReaderPlus/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.25+-00ADD8?logo=go)](https://go.dev)
[![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js)](https://vuejs.org)

[快速开始](#快速开始) · [格式支持](#格式支持) · [架构](#架构) · [快捷键](#快捷键) · [文档](#文档)

</div>

---

## 简介

X-ReaderPlus 是一款**完全脱机**的桌面多格式电子书阅读器。不依赖网络、不收集数据、不上传文件。所有数据加密存储在本地 SQLite 中。

### 核心特性

| 特性 | 说明 |
|------|------|
| 🔒 **完全脱机** | 除词典 API 外零网络请求，断网环境完美运行 |
| 🛡️ **隐私至上** | 3 数据库分离，AES-256-GCM 加密可选，PIN 锁保护 |
| 📚 **17 种格式** | EPUB / PDF / TXT / FB2 / DJVU / CHM / LIT / LRF / DOCX / RTF / ODT / Markdown / HTML / CBZ / CBT |
| ⚡ **极速编译** | Wails 构建，二进制 ~24 MB，单文件发布 |
| 🎨 **Material Design 3** | Vuetify 3 组件，亮/暗/护眼三主题 |
| 📖 **三阅读模式** | 滚动 / 翻页（点击+键盘←→） / 自动滚屏（可调速度） |
| 🔍 **全文搜索** | 跨书籍全文索引，支持中文分词 |
| 📝 **标注系统** | 6 色高亮 + 笔记，支持导出 CSV/Markdown/JSON |
| 🔖 **书签管理** | 跨章节书签，快速跳转 |
| 🗑️ **回收站** | 删除保护，误删可恢复 |
| 📊 **阅读统计** | 阅读日历热力图、周统计图表、格式分布 |
| ☁️ **WebDAV 备份** | AES-256-GCM 端到端加密备份 |
| 🔐 **隐私锁** | 书库/书籍级密码加密（AES-256-GCM） |
| 🎯 **专注模式** | 滚动式焦点高亮，段落级居中 |
| ✍️ **自定义字体** | 上传 .ttf/.otf/.woff/.woff2 |
| 🏷️ **标签管理** | 自定义标签 + 智能收藏夹 |
| 🌐 **多平台** | Windows / macOS / Linux |

---

## 格式支持

| 格式 | 状态 |
|------|------|
| EPUB / PDF / TXT / Markdown / HTML / FB2 | ✅ 完整支持 |
| DJVU / DOCX / RTF / ODT / CHM / LIT / LRF | ✅ 完整支持 |
| CBZ / CBT | ✅ 图片提取 50-200 页 |
| CBR / CB7 | ⚠️ 不可用（专有格式，请转 CBZ） |
| MOBI / AZW3 / PRC / PDB | ❌ 已禁用（解析不稳定） |

---

## 快速开始

### 下载安装

访问 [Releases](https://github.com/stop666two/X-ReaderPlus/releases) 下载对应平台版本。所有版本均为**单文件便携版**，数据存储在程序同目录的 `data/` 文件夹中。

#### 🪟 Windows

| 你的系统 | 下载 |
|----------|------|
| Windows x64（64 位） | `windows/X-ReaderPlus-win-x64.exe` |
| Windows x86（32 位） | `windows/X-ReaderPlus-win-x86.exe` |
| Windows ARM | `windows/X-ReaderPlus-win-arm64.exe` |

> 单文件便携版，无需安装，放在 U 盘也能用。数据自动保存在 exe 同目录的 `data/` 下。

#### 🍎 macOS

| 芯片 | 下载 |
|------|------|
| Intel | `macos/X-ReaderPlus-mac-intel.dmg` |
| Apple Silicon | `macos/X-ReaderPlus-mac-apple.dmg` |

> 原生 .app 打包为 .dmg，拖入 Applications 即完成安装。

#### 🐧 Linux

| 架构 | 下载 |
|------|------|
| x86_64 | `linux/X-ReaderPlus-linux-amd64` + `linux/X-ReaderPlus-linux-x86_64.AppImage` |
| ARM64 | `linux/X-ReaderPlus-linux-arm64` |

> AppImage 为单文件格式，`chmod +x` 后直接运行。

### 开发构建

```bash
git clone https://github.com/stop666two/X-ReaderPlus.git
cd X-ReaderPlus
npm install

# 前端开发
npm run dev

# 后端开发
cd backend && go run .

# 生产构建（单文件）
npm run build:all

# 一键重建
.\rebuild.bat
```

---

## 架构

```
前端:  Vue 3 (Vite) ──fetch──→ Go REST API (:34123) ──→ SQLite × 3
发布:  前端静态文件嵌入 Go 二进制 → 单文件
桌面壳: WebView2 (Win) / WebKit (Mac) / GTK (Linux)
```

| 层 | 技术 |
|---|------|
| 前端 | Vue 3.5 + Vuetify 3 + Pinia 3 + TypeScript |
| 后端 | Go 1.25 + modernc.org/sqlite |
| 桌面壳 | Wails v2 |
| 加密 | Web Crypto API + Go crypto |
| 构建 | Vite 6 + Wails 2 |

---

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+F` | 搜索 |
| `Ctrl+B` | 书签 |
| `Ctrl+K` | 命令面板 |
| `Ctrl+T` | 切换主题 |
| `Ctrl+Shift+F` | 专注模式 |
| `←` / `→` | 翻页模式：上下页 |
| `PageUp` / `PageDown` | 翻页/滚动一屏 |
| `Space` | 下一页/向下滚动 |
| `Esc` | 关闭弹窗/返回 |

---

## 限制

| 限制 | 值 |
|------|-----|
| 单文件最大 | 500 MB |
| EPUB 文件数 | 10000 个 |
| PDF 最大页数 | 500 页 |
| 漫画页数 (CBZ/CBT) | 50 / 200 页 |
| PIN PBKDF2 迭代 | 60 万次 |
| 加密算法 | AES-256-GCM |
| 服务绑定 | 127.0.0.1 |
| 阅读历史 | 500 条 |
| 阅读统计 | 365 天 |

---

## 捐赠

本软件完全免费开源。

```
USDT (ETH/ERC20 & BSC/BEP20):
0xbB515f953e16f0a7b51f537BB1DAB6fbB6026533
```

**严禁倒卖。** 本软件及其衍生作品不得以任何形式出售。

---

## 相关文档

| 文档 | 说明 |
|------|------|
| [CHANGELOG.md](CHANGELOG.md) | 版本变更记录 |
| [AGENTS.md](AGENTS.md) | 开发规范与红线 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 贡献指南 |
| [SECURITY.md](SECURITY.md) | 安全策略 |
| [ROADMAP.md](ROADMAP.md) | 路线图 |

---

## 协议

MIT License © 2026 stop666. 详见 [LICENSE](LICENSE).
