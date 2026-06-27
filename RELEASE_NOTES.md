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

## 📦 下载

### 我该下哪个？

| 你的电脑 | 下载这个 |
|----------|----------|
| Windows 64 位（大多数电脑） | `X-ReaderPlus-win-x64` |
| Windows 32 位（老电脑） | `X-ReaderPlus-win-x86` |
| Windows ARM（Surface Pro X 等） | `X-ReaderPlus-win-arm64` |
| Windows 不想折腾 → 解压即用 | `X-ReaderPlus-win-portable.zip` |
| Mac Intel 芯片（2020 年前） | `X-ReaderPlus-mac-intel` |
| Mac Apple Silicon（M1/M2/M3） | `X-ReaderPlus-mac-apple` |
| Linux x86_64 | `X-ReaderPlus-linux-amd64` |
| Linux ARM64（树莓派等） | `X-ReaderPlus-linux-arm64` |

> **不确定？** Windows 用户一律推荐 `X-ReaderPlus-win-portable.zip`，解压双击即用。Mac 用户去「关于本机」看处理器是 Intel 还是 Apple。

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
