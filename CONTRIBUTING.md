# Contributing to X-ReaderPlus

感谢你的贡献！请遵循以下指南。

## 行为准则

- 尊重他人，建设性沟通
- 严禁倒卖本项目或衍生作品
- 所有贡献必须在 MIT 协议下

## 开发环境

```bash
git clone https://github.com/stop666two/X-ReaderPlus.git
cd X-ReaderPlus
npm install
```

### 启动开发

```bash
# 终端 1: 前端 (Vite 开发服务器 :5173)
npm run dev

# 终端 2: 后端 (Go REST API :34123)
cd backend && go run .

# 禁用 WebView 调试模式（仅启动 API 服务）
$env:XREADER_NO_WEBVIEW="1"; cd backend; go run .
```

### 生产构建

```bash
# 完整构建（vite build → copy-frontend → wails build）
npm run build:all

# 仅 Go 后端构建（需先 npm run build）
npm run build:go

# 一键完整重建
.\rebuild.bat
```

## 代码规范

### TypeScript / Vue

- **TypeScript**: `vue-tsc --noEmit` 零错误
- **Vue**: Composition API + `<script setup>` 模式
- **Pinia Store**: UI 状态与业务逻辑分离，使用 async/await，try/catch 日志记录
- **类型**: 所有类型定义在 `src/types/index.ts`，新增属性时同步更新

### Go

- **编译**: `go vet ./...` 零警告
- **错误处理**: 所有 `Exec`/`QueryRow` 检查返回值，不静默丢弃
- **事务**: 跨表操作使用 `Begin()`/`Commit()`/`Rollback()`
- **JSON**: 统一使用 `jsonOK`/`jsonErr` 辅助函数

### CSS

- 遵循 Vuetify 3 命名约定
- 组件内使用 `<style scoped>`，全局样式放在 `src/style.css`

## 提交规范

### Commit 格式

```
<type>: <简短描述>

类型:
  feat      新功能
  fix       修复
  perf      性能优化
  refactor  重构
  docs      文档
  style     格式
  test      测试
  chore     构建/工具
```

## 项目结构

```
X-ReaderPlus/
├── src/                    # Vue 3 前端
│   ├── views/              # 页面视图 (11 个)
│   ├── stores/             # Pinia 状态 (5 个)
│   ├── services/           # API 桥接 + 格式解析器 + 加密
│   ├── composables/        # 可复用组合函数
│   ├── plugins/            # Vuetify / i18n 插件
│   ├── locales/            # 国际化 (zh-CN / en-US)
│   ├── router/             # Vue Router (hash 模式)
│   └── types/              # TypeScript 类型
├── backend/                # Go 后端
│   ├── main.go             # HTTP 服务 + 前端嵌入
│   ├── app.go              # Wails App + 文件操作
│   ├── webview_*.go        # 平台窗口 (Win/Mac/Linux)
│   ├── db/                 # SQLite 3 数据库
│   │   ├── database.go     # 初始化 + 迁移
│   │   └── main.go
│   ├── api/                # REST API handlers
│   └── go.mod / go.sum
├── public/icon.svg         # 应用 SVG 图标
├── scripts/                # 构建与打包脚本
│   ├── copy-frontend.js
│   ├── installer.nsi
│   ├── build-macos.sh
│   └── build-linux.sh
├── .github/workflows/      # CI/CD (build + release)
├── CHANGELOG.md            # 版本变更记录
├── ROADMAP.md              # 路线图
└── package.json
```

## 国际化

翻译文件位于 `src/locales/`：
- `zh-CN.ts` — 简体中文（主要语言）
- `en-US.ts` — 英文

添加新翻译时同步更新两个文件。

## 相关文档

- [README](README.md) — 项目介绍
- [AGENTS.md](AGENTS.md) — 开发规范
- [SECURITY](SECURITY.md) — 安全策略
- [ROADMAP.md](ROADMAP.md) — 路线图
- [CHANGELOG.md](CHANGELOG.md) — 版本记录
