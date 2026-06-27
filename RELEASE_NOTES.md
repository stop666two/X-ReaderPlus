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

### Windows

| 架构 | 文件 |
|------|------|
| 64-bit (x64) | `X-ReaderPlus-Windows-amd64/x-reader-amd64.exe` |
| 32-bit (x86) | `X-ReaderPlus-Windows-386/x-reader-386.exe` |
| ARM64 | `X-ReaderPlus-Windows-arm64/x-reader-arm64.exe` |
| 便携版 (含前端) | `X-ReaderPlus-Windows-Portable.zip` |

### macOS

| 芯片 | 文件 |
|------|------|
| Apple Silicon (M1/M2/M3) | `X-ReaderPlus-macOS-arm64/x-reader-arm64` |
| Intel | `X-ReaderPlus-macOS-amd64/x-reader-amd64` |

### Linux

| 架构 | 文件 |
|------|------|
| x86_64 | `X-ReaderPlus-Linux-amd64/x-reader-amd64` |
| ARM64 | `X-ReaderPlus-Linux-arm64/x-reader-arm64` |

---

## ⚠️ 安装注意事项

### Windows

1. **便携版** (`Portable.zip`) 解压后直接双击 `x-reader.exe` 即可运行，无需安装。
2. **单文件版** 需配合前端文件。先解压便携版获取 `dist/` 目录，将 `x-reader.exe` 放入 `dist/` 同目录，确保 `dist/` 目录存在。
3. 首次运行会自动创建数据库目录 `%APPDATA%\x-reader-plus\X-ReaderPlus\data\`。
4. 如遇 Windows Defender 拦截，点击"更多信息"→"仍要运行"。本软件完全开源无恶意代码。
5. **不要将程序放在系统保护目录**（如 `C:\Program Files`、`C:\Windows`），推荐放在 `D:\X-ReaderPlus` 或桌面。

### macOS

1. 下载对应芯片版本后，在终端执行：
   ```bash
   chmod +x x-reader-arm64    # Apple Silicon
   chmod +x x-reader-amd64    # Intel
   ./x-reader-arm64
   ```
2. 首次运行如提示"无法验证开发者"，进入 **系统设置 → 隐私与安全性 → 仍要打开**。
3. 确保 `dist/` 目录与可执行文件在同一目录。

### Linux

1. 赋予执行权限：
   ```bash
   chmod +x x-reader-amd64
   ./x-reader-amd64
   ```
2. 需要 GTK3 或 WebKit2GTK 运行环境。Ubuntu/Debian 用户：
   ```bash
   sudo apt install libgtk-3-0 libwebkit2gtk-4.1-0
   ```
3. 确保 `dist/` 目录与可执行文件在同一目录。

### 通用

- 数据库存储在用户目录下的 `x-reader-plus/X-ReaderPlus/data/`
- 首次启动自动创建示例书籍
- **不要手动删除或修改数据库文件**，避免数据损坏
- WebDAV 备份建议先测试连接再执行备份

---

## 📋 完整变更

详见 [GitHub 提交记录](https://github.com/stop666two/X-ReaderPlus/commits/main)。

---

© 2026 stop666. MIT License.
