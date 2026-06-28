# X-ReaderPlus v0.3.1

**格式扩展** — 新增 PRC, PDB, CHM, LIT, LRF 支持，覆盖 Z-Library 全格式。

---

## 🆕 本版亮点

### 📚 21 种格式全覆盖

新增 5 种格式解析支持，覆盖 Z-Library 所有常见格式：

| 新格式 | 扩展名 | 解析方式 |
|--------|--------|----------|
| **PRC** | `.prc` | PalmDOC 二进制解析（复用 MOBI 引擎） |
| **PDB** | `.pdb` | PalmDOC 二进制解析（复用 MOBI 引擎） |
| **CHM** | `.chm` | ITSF 格式 HTML 提取 |
| **LIT** | `.lit` | OLE2 复合文档 HTML 提取 |
| **LRF** | `.lrf` | BBeB XML 解析 |

> 加上原有的 EPUB, MOBI, AZW3, PDF, TXT, FB2, DJVU, DOCX, RTF, ODT, Markdown, HTML, CBZ, CBR, CBT, CB7 共 **21 种格式**。

### 🔧 其他改进

- 修复 CI 构建流水线 (Windows NSIS + Linux AppImage)
- 修复 Release 自动发布机制
- 完善项目文档 6 份
- 标注专注模式已知问题
- 修复 `clearAllHistory`/`clearAllStats` 数据丢失风险（改用专用 DELETE 端点）
- 修复 LIT 格式作者信息提取
- 修复 LibraryView/TagsView 多处响应式失效
- 修复 PinUnlockView 定时器泄漏
- 修复笔记操作 API 错误处理与数据回滚
- 引入 ESLint v9 代码质量检查
- 版本号统一为 v0.3.1（安装程序/Info.plist）

---

## ⚠️ 已知问题

### 专注模式

专注模式为 v0.3.0 新增的实验性功能，以下问题将在后续版本中修复：

| 问题 | 影响 | 计划修复 |
|------|------|----------|
| 状态不持久化 | 切换页面后自动关闭，需重新点击 🎯 图标开启 | ✅ v0.3.1 已修复 |
| 无键盘快捷键 | 只能通过鼠标点击工具栏图标操作 | ✅ v0.3.1 已修复 (`Ctrl+Shift+F`) |
| 遮罩层滚动偶现偏移 | 快速滚动时暗色遮罩可能未对齐阅读区域 | v0.3.2 |

### 其他

- NSIS 安装程序（`X-ReaderPlus-Setup-x64.exe`）在某些 Windows 环境中可能无法构建，此产物在 Release 中可能缺失。Windows 用户推荐使用便携版 `X-ReaderPlus-win-x64-portable.zip`。
- Linux ARM64 为无头模式（纯 CLI），需手动打开浏览器访问 `http://127.0.0.1:34123`。
- macOS Intel 为无头模式（CGO 禁用构建设限），需手动打开浏览器访问 `http://127.0.0.1:34123`。Apple Silicon 用户推荐使用 `-mac-apple.dmg`。

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
