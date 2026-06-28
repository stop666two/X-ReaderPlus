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
# 终端1: 前端
npm run dev          # http://localhost:5173

# 终端2: 后端
cd backend
go run .            # http://127.0.0.1:34123
```

## 提交规范

### Commit 格式

```
<type>: <简短描述>

类型:
  feat     新功能
  fix      修复
  perf     性能优化
  refactor 重构
  docs     文档
  style    格式
  test     测试
  chore    构建/工具
```

### 代码规范

- **TypeScript**: `vue-tsc --noEmit` 零错误
- **Go**: `go build` 零错误零警告
- **CSS**: 遵循 Vuetify 3 命名约定
- **Vue**: Composition API + `<script setup>`

## 提交流程

1. Fork 仓库
2. 创建分支: `git checkout -b feat/your-feature`
3. 提交修改: `git commit -m "feat: add something"`
4. 推送: `git push origin feat/your-feature`
5. 创建 Pull Request

## 项目结构

```
X-ReaderPlus/
├── src/                    # Vue 3 前端
│   ├── views/              # 页面视图 (11 个)
│   ├── stores/             # Pinia 状态管理 (5 个)
│   ├── services/           # API 桥接 + 格式解析器
│   ├── composables/        # 可复用组合函数
│   ├── plugins/            # Vuetify / i18n 插件
│   ├── locales/            # 国际化 (zh-CN / en-US)
│   ├── router/             # Vue Router
│   ├── types/              # TypeScript 类型声明
│   └── main.ts
├── backend/                # Go 后端
│   ├── main.go             # HTTP 服务器 + 前端嵌入
│   ├── types.go            # 共享类型
│   ├── webview_*.go        # 平台特定窗口实现
│   ├── db/                 # SQLite 数据库初始化
│   ├── api/                # REST API handlers
│   └── frontend/           # 构建时嵌入的前端文件 (gitignored)
├── scripts/                # 构建与打包脚本
│   ├── copy-frontend.js    # 复制前端 dist → backend/frontend
│   ├── installer.nsi       # NSIS Windows 安装程序
│   ├── build-macos.sh      # macOS .app + .dmg 打包
│   └── build-linux.sh      # Linux AppImage 打包
├── .github/workflows/      # CI/CD (build + release)
├── public/icon.svg         # 应用图标
└── package.json
```

## 核心原则

1. **完全脱机**: 除词典 API 外零网络
2. **隐私至上**: 数据只存本地 SQLite
3. **简洁**: 不为功能牺牲性能

## 问题反馈

- [GitHub Issues](https://github.com/stop666two/X-ReaderPlus/issues)
- 附上控制台日志和复现步骤

## 国际化 (i18n)

翻译文件位于 `src/locales/`：

```
src/locales/
├── zh-CN.ts    # 简体中文（主要）
└── en-US.ts    # 英文
```

添加新翻译时：
1. 在 `zh-CN.ts` 中添加 key
2. 在 `en-US.ts` 中同步添加英文翻译
3. 组件中使用 `$t('key')` 引用

## 测试

```bash
# 前端类型检查
npm run lint           # vue-tsc --noEmit

# Go 编译检查
cd backend && go build ./...
```

---

## 相关文档

- [README](README.md) — 项目介绍
- [AGENTS.md](AGENTS.md) — 开发规范
- [SECURITY](SECURITY.md) — 安全策略
- [ROADMAP](ROADMAP.md) — 路线图
