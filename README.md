# X-ReaderPlus

<div align="center">

**完全脱机 · 隐私至上 · 多格式 · 高性能**

[![Build](https://github.com/stop666two/X-ReaderPlus/actions/workflows/build.yml/badge.svg)](https://github.com/stop666two/X-ReaderPlus/actions/workflows/build.yml)
[![Version](https://img.shields.io/badge/version-0.3.0-blue)](https://github.com/stop666two/X-ReaderPlus/releases)
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
| 📚 **12+ 格式** | EPUB, MOBI, AZW3, PDF, TXT, Markdown, HTML, FB2, DJVU, DOCX, ODT, CBZ, CBT |
| ⚡ **极速编译** | Go 后端编译 <1 分钟，二进制 ~12MB |
| 🎨 **Material Design 3** | Vuetify 3 组件，亮色/暗色/护眼三主题 |
| 🔍 **全文搜索** | 跨书籍全文索引搜索，支持中文分词 |
| 📝 **标注系统** | 高亮/下划线/笔记，多色标注 |
| 🔖 **书签管理** | 跨章节书签，快速跳转 |
| 🗑️ **回收站** | 删除保护，误删可恢复 |
| 📊 **阅读统计** | 阅读时间、字数、进度全追踪 |
| ☁️ **WebDAV 备份** | AES-256-GCM 端到端加密备份，换设备无缝恢复 |
| 🎯 **专注模式** | 60% 暗色遮罩 + 中心段落加粗，沉浸阅读（实验性功能，见[已知问题](RELEASE_NOTES.md#已知问题)） |

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

> **Windows 推荐**下载 Setup 安装程序，带开始菜单/桌面快捷方式/卸载程序/开机自启选项。
> **Mac** 打开 dmg 拖入 Applications。**Linux** `chmod +x *.AppImage` 后直接运行。

详情见 [RELEASE_NOTES.md](RELEASE_NOTES.md)。

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

详细开发指南见 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## 文档

| 文档 | 说明 |
|------|------|
| [AGENTS.md](AGENTS.md) | 开发规范与红线 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 贡献指南 |
| [SECURITY.md](SECURITY.md) | 安全策略 |
| [RELEASE_NOTES.md](RELEASE_NOTES.md) | 版本更新日志 |
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
| `Esc` | 关闭弹窗/返回 |
| 点击工具栏 🎯 图标 | 专注模式（实验性） |

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

MIT License © 2026 stop666. 详见 [LICENSE](LICENSE)。
