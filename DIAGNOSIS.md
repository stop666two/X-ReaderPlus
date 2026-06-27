# X-ReaderPlus 编译后无法运行 — 诊断报告（已修复）

> 日期: 2026-06-27 | 版本: v0.3.0

---

## 现象

从 GitHub Actions 编译的 Release 中下载 exe 后双击完全无反应（无窗口、无控制台、无任何提示）。

---

## 根本原因

### 1. Go 后端不提供前端服务 ✅ 已修复

原 `backend/main.go` 只注册了 `/api/*` 路由，没有嵌入前端文件，没有 `http.FileServer`。

**修复**: `//go:embed all:frontend` 将 Vite 编译产物嵌入 Go 二进制，通过 `http.FileServer(http.FS(frontendFS))` 提供静态服务。构建前由 `scripts/copy-frontend.js` 自动复制 `dist/` → `backend/frontend/`。

### 2. 无桌面窗口壳 ✅ 已修复

**修复**: 全平台原生窗口。
- **Windows**: `webview_windows.go` — go-webview2（纯 Go，无 CGo），无边框窗口 + Vue 自绘标题栏 + DWM 阴影
- **macOS**: `webview_darwin.go` — webview_go Cocoa（CGo），系统原生窗口控件
- **Linux**: `webview_linux.go` — webview_go GTK（CGo），系统原生窗口控件

### 3. 构建产物不含前端 ✅ 已修复

前端通过 `//go:embed` 嵌入 Go 二进制，所有产物为单一自包含文件。

### 4. Vite 打包绝对路径 ✅ 已修复

`vite.config.ts` 添加 `base: './'`。

### 5. build.yml 产物错误 ✅ 已修复

- 非便携构建只上传了 exe（缺失前端）
- 便携构建虽然含前端但 Go 不计提供它

**修复**: 全平台构建流程统一为 `npm run build` → `copy-frontend.js` → `go build`，产物均为独立可执行文件。

---

## 构建流程

```bash
npm run build       # 前端 Vite → dist/
npm run build:go    # 复制 dist/ → backend/frontend/ → go build
npm run build:all   # 一键构建

npm run dev          # 前端 Dev :5173
npm run dev:go       # 后端 Dev :34123
$env:XREADER_NO_WEBVIEW="1"  # 禁用窗口调试模式
```

## 产物矩阵

| 平台 | 产物 |
|---|---|
| Windows x64 | `X-ReaderPlus-Setup-x64.exe` (NSIS 安装程序) |
| Windows x86/arm64 | `X-ReaderPlus-win-{arch}.exe` |
| macOS Intel/Apple | `X-ReaderPlus-mac-{intel/apple}.dmg` |
| Linux amd64/arm64 | `X-ReaderPlus-linux-{arch}.AppImage` |

## 修改的文件

| 文件 | 改动 |
|------|------|
| `vite.config.ts` | 添加 `base: './'` |
| `package.json` | 更新 build 脚本 |
| `backend/main.go` | embed 前端 + FileServer + 统一入口 |
| `backend/webview_windows.go` | 新增：go-webview2 无边框窗口 |
| `backend/webview_darwin.go` | 新增：webview_go Cocoa 原生窗口 |
| `backend/webview_linux.go` | 新增：webview_go GTK 原生窗口 |
| `backend/webview_other.go` | 更新 build tag |
| `backend/go.mod` | 添加 go-webview2 + webview_go |
| `src/App.vue` | 一行：`window.__xr_native_titlebar` 检测 |
| `src/services/db.ts` | 清理 Tauri 残留引用 |
| `.github/workflows/build.yml` | 全平台构建+打包 (NSIS/DMG/AppImage) |
| `scripts/copy-frontend.js` | 新增：复制前端并过滤 .exe |
| `scripts/installer.nsi` | 新增：NSIS 安装程序 |
| `scripts/build-macos.sh` | 新增：macOS .app + .dmg 打包 |
| `scripts/build-linux.sh` | 新增：Linux AppImage 打包 |
| `.gitignore` | 排除 backend/frontend/* |
| `README.md` | 更新下载说明和构建命令 |
| `AGENTS.md` | 更新文件结构和 Go 版本 |
| `ROADMAP.md` | WebView2 标为已完成 |
