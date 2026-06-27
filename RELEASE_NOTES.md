# Release Notes — v0.3.0

## 🚀 X-ReaderPlus v0.3.0

**完全脱机的现代化多格式桌面阅读器** — 首个稳定版本。

---

### 🏗️ 架构

- **Go 后端**: 替代 Rust/Tauri，编译时间从 5-10 分钟降至 <1 分钟
- **3 SQLite 数据库**: settings.db / content.db / meta.db 分离存储
- **HTTP REST API**: Vue 3 前端通过 fetch() 与 Go 后端通信
- **Pure Go SQLite**: modernc.org/sqlite，零 CGO 依赖

### ✨ 核心功能

- 📚 **12+ 格式支持**: EPUB, MOBI, AZW3, PDF, TXT, Markdown, HTML, FB2, DJVU, DOCX, ODT, CBZ, CBT
- 🔍 **全文搜索**: 跨书籍中文分词索引，实时搜索
- 📝 **多色标注**: 5 色高亮 + 下划线 + 笔记
- 🔖 **书签系统**: 跨章节书签管理
- 🗑️ **回收站**: 删除保护，一键恢复
- 📊 **阅读统计**: 阅读时间、字数、进度全追踪
- 🎯 **专注模式**: 60% 暗色遮罩 + 中心段落加粗
- 🌓 **三主题**: 亮色 / 暗色 / 护眼
- 🔒 **隐私锁**: AES-256-GCM + PBKDF2 60 万次加密
- ☁️ **WebDAV 备份**: 端到端加密，跨设备恢复
- 🏷️ **标签管理**: 自定义标签，批量操作
- 📂 **书库管理**: 多书库组织书籍
- 📖 **阅读记忆**: 自动恢复上次阅读位置
- ⌨️ **快捷键**: 可配置键盘快捷键

### 🛡️ 安全性

- CSP 严格策略，禁止内联脚本
- PIN 锁 + 失败升级机制
- WebDAV 文件名+内容全加密
- 密钥 PBKDF2 派生，永不留存

### 🔧 修复

- 修复 Rust 编译慢问题 (迁移至 Go)
- 修复数据库访问串行化性能瓶颈
- 修复专注模式覆盖层错位
- 修复导出功能 (支持原始格式下载)
- 修复历史/统计数据持久化
- 修复批量删除计数显示
- 修复章节导航滚动位置恢复
- 修复 60+ 代码质量问题

### 📦 下载

| 平台 | 文件 |
|------|------|
| Windows | `X-ReaderPlus-Windows.zip` |
| macOS | `X-ReaderPlus-macOS.tar.gz` |
| Linux | `X-ReaderPlus-Linux.tar.gz` |

---

**完整更新日志**: [GitHub Commits](https://github.com/stop666two/X-ReaderPlus/commits/main)
