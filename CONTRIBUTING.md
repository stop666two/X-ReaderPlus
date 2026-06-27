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
│   ├── views/              # 页面
│   ├── stores/             # Pinia 状态
│   ├── services/           # API 桥接 + 解析器
│   └── main.ts
├── backend/                # Go 后端
│   ├── main.go             # HTTP 服务器
│   ├── db/database.go      # SQLite 初始化
│   └── api/handlers.go     # REST API
└── .github/workflows/      # CI/CD
```

## 核心原则

1. **完全脱机**: 除词典 API 外零网络
2. **隐私至上**: 数据只存本地 SQLite
3. **简洁**: 不为功能牺牲性能

## 问题反馈

- [GitHub Issues](https://github.com/stop666two/X-ReaderPlus/issues)
- 附上控制台日志和复现步骤

---

## 相关文档

- [README](README.md) — 项目介绍
- [AGENTS.md](AGENTS.md) — 开发规范
- [SECURITY](SECURITY.md) — 安全策略
- [ROADMAP](ROADMAP.md) — 路线图
