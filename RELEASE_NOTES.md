# X-ReaderPlus v0.3.0

**首个 Go 架构稳定版** — 完全脱机的现代化多格式桌面阅读器。

---

## 🆕 本版亮点

### 🏗️ 架构重写：Rust/Tauri → Go + HTTP

编译时间从 **5-10 分钟降至 <1 分钟**。后端从 587 个 Rust crate 精简为 6 个 Go 包。前端不变 (Vue 3 + Vuetify 3)，通过 HTTP REST API 通信。

### 🗄️ 3 数据库分离存储

```
settings.db  →  配置、主题、PIN
content.db   →  章节内容、原始文件
meta.db      →  书籍、书签、标注、回收站、历史、统计
```

### 🔍 全文搜索

跨书籍中文分词索引，实时搜索章节内容。

### 📝 完整标注系统

5 色高亮 + 下划线 + 笔记。跨章节管理，搜索定位。

### 🎯 全新专注模式

60% 不透明度遮罩覆盖阅读区，屏幕中央段落自动加粗高亮，随滚动实时追踪。

### ☁️ WebDAV 加密备份

文件名 URL-safe 混淆，文件内容 AES-256-GCM 加密。PBKDF2 60 万次密钥派生，密钥永不留存。换设备只需输入密码即可恢复。

### 📖 阅读进度记忆

临时退出自动保存章节和滚动位置。再次打开精确恢复。

### 🔧 60+ 项修复

- 修复专注模式覆盖层错位
- 修复导出功能（支持原始格式下载）
- 修复历史/统计持久化
- 修复批量删除计数
- 修复章节导航滚动恢复
- 修复页面过渡动画
- 修复进度条百分比
- 修复返回按钮无响应
- 全 CSP 安全策略加固

---

## ⚠️ 已知问题

### 专注模式

专注模式为 v0.3.0 新增的实验性功能，以下问题将在后续版本中修复：

| 问题 | 影响 | 计划修复 |
|------|------|----------|
| 状态不持久化 | 切换页面后自动关闭，需重新点击 🎯 图标开启 | v0.3.1 |
| 遮罩层滚动偶现偏移 | 快速滚动时暗色遮罩可能未对齐阅读区域 | v0.3.1 |
| 无键盘快捷键 | 只能通过鼠标点击工具栏图标操作 | v0.4.0 |

### 其他

- NSIS 安装程序（`X-ReaderPlus-Setup-x64.exe`）在某些 Windows 环境中可能无法构建，此产物在 Release 中可能缺失。Windows 用户推荐使用便携版 `X-ReaderPlus-win-x64-portable.zip`。
- Linux ARM64 为无头模式（纯 CLI），需手动打开浏览器访问 `http://127.0.0.1:34123`。

---

## 📦 下载

### 我该下哪个？

| 你的电脑 | 下载这个 |
|----------|----------|
| Windows 64 位（大多数电脑） | `X-ReaderPlus-win-x64` 或 `X-ReaderPlus-win-x64-portable.zip` |
| Windows 32 位（老电脑） | `X-ReaderPlus-win-x86-portable` |
| Windows ARM（Surface Pro X 等） | `X-ReaderPlus-win-arm64-portable` |
| Mac Intel 芯片（2020 年前） | `X-ReaderPlus-mac-intel.dmg` |
| Mac Apple Silicon（M1/M2/M3） | `X-ReaderPlus-mac-apple.dmg` |
| Linux x86_64 | `X-ReaderPlus-linux-amd64` |
| Linux ARM64（树莓派等） | `X-ReaderPlus-linux-arm64` |

> **不确定？** Windows 用户一律推荐 `X-ReaderPlus-win-x64-portable.zip`，解压双击即用。Mac 用户去「关于本机」看处理器是 Intel 还是 Apple。

---

## ⚠️ 安装注意事项

### Windows

1. **便携版** (`win-portable.zip`)：解压到任意目录（推荐 `D:\X-ReaderPlus`），双击 `X-ReaderPlus.exe`。
2. **单文件版** (`win-x64`/`win-x86`/`win-arm64`)：需放在包含 `dist/` 目录的文件夹中（`dist/` 来自解压便携版后的目录）。
3. 如遇 Windows Defender 拦截，点击**"更多信息"→"仍要运行"**。本软件开源无毒。
4. **不要放在系统保护目录**（`C:\Program Files`、`C:\Windows`），否则无法写入数据。
5. 首次运行自动创建数据库 `%APPDATA%\x-reader-plus\X-ReaderPlus\data\`。

### macOS

1. 下载后在终端执行：
   ```bash
   chmod +x X-ReaderPlus-mac-apple    # Apple Silicon
   chmod +x X-ReaderPlus-mac-intel    # Intel
   ```
2. 首次运行提示"无法验证开发者"→ **系统设置 → 隐私与安全性 → 仍要打开**。
3. 需与 `dist/` 目录放在同一文件夹。

### Linux

1. ```bash
   chmod +x X-ReaderPlus-linux-x64
   ./X-ReaderPlus-linux-x64
   ```
2. Ubuntu/Debian 需安装依赖：
   ```bash
   sudo apt install libgtk-3-0 libwebkit2gtk-4.1-0
   ```
3. 需与 `dist/` 目录放在同一文件夹。

### 通用

- 数据库：`~/.config/x-reader-plus/X-ReaderPlus/data/` (Linux/Mac) 或 `%APPDATA%\x-reader-plus\` (Win)
- 首次启动自动创建示例书籍
- 不要手动修改数据库文件
- WebDAV 备份前先点击"测试连接"

---

## 📋 完整变更

详见 [GitHub 提交记录](https://github.com/stop666two/X-ReaderPlus/commits/main)。

---

© 2026 stop666. MIT License.

最后更新: 2026-06-28
