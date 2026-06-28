# Security Policy

## 报告漏洞

如发现安全漏洞，请 **不要** 创建公开 Issue。

请发送邮件到项目作者 `stop666` 的 GitHub 关联邮箱，或通过 [GitHub Security Advisories](https://github.com/stop666two/X-ReaderPlus/security/advisories/new) 私密提交。

### 披露时间线

- 收到报告后 **48 小时** 内确认
- **7 天** 内完成评估和修复方案
- 修复发布后 **30 天** 公开披露细节

## 安全架构

### 数据存储

- **3 SQLite 数据库分离**: `settings.db` / `content.db` / `meta.db`
- 存储路径: `%APPDATA%/x-reader-plus/X-ReaderPlus/data/` (Windows)
- 可选 AES-256-GCM 数据库加密
- SQLite 单连接 WAL 模式确保数据完整性

### 网络安全

- **零网络请求** (除词典 API `api.dictionaryapi.dev`)
- 服务仅绑定 **127.0.0.1:34123** (仅本机，不接受外部连接)
- WebDAV 备份: AES-256-GCM 端到端加密
  - 文件名 URL-safe base64 混淆
  - 文件内容 AES-256-GCM (随机 12 字节 IV 前置)
  - 密钥 PBKDF2-SHA256 派生 (仅存 32 字节盐，不存密钥)

### HTML 内容安全

- **DOMPurify** 白名单过滤：仅允许安全的 HTML 标签和属性
- 禁止元素: `<script>`, `<style>`, `<svg>`, `<iframe>`, `<object>`, `<embed>`, `<link>`, `<meta>`, `<base>`, `<form>`
- 允许标签: h1-h6, p, br, hr, 内联格式, 列表, 表格, a, img, span, div
- 允许属性: href, src, alt, title, class, id, width, height, style, data-*
- **禁止协议**: `javascript:` → `blocked:`；仅允许 http/https/mailto/tel
- **所有 `on*` 事件处理器**被移除
- **inline style 中的 `url()`** 全部替换为 `none`

### 加密常量

| 参数 | 值 | 用途 |
|------|-----|------|
| PBKDF2 迭代 | 600,000 | PIN 哈希、隐私锁密钥、WebDAV 密钥 |
| AES 密钥 | 256 位 | AES-256-GCM |
| IV 长度 | 12 字节 | 加密初始化向量 |
| 盐长度 | 32 字节 | 密钥派生随机盐 |

### PIN 锁

- 适用场景: 应用入口保护
- 4 位以上数字
- 阶梯式锁定:
  - **0-4 次**: 正常尝试
  - **5 次**: 30 秒锁定
  - **15 次** (5+10): 5 分钟锁定
- PBKDF2-SHA256 哈希，60 万次迭代 + 32 字节随机盐
- 常量时间比较 (timing-safe)
- 安全密码重置问题 (6 选 1，答案哈希存储)

### 隐私锁

- 适用场景: 单本书或书库加密（数据库级别 AES-256-GCM）
- 密码最低 **8 字符**，必须包含大写字母 + 小写字母 + 数字
- PBKDF2-SHA256 60 万次迭代密钥派生
- 加密验证: 先加密 → 解密验证 → 确认无误后删除明文
- 加密失败自动回滚，保留明文数据

### 外部链接安全

- 阅读器内 `<a href="https://...">` 通过 `ShellExecuteW` 打开系统默认浏览器 (Windows)
- 防止 WebView 内打开不可信外部页面

## 依赖项

保持依赖项更新，使用 `npm audit` 和 `go mod tidy` 定期检查。

## 版本支持

| 版本 | 状态 |
|------|------|
| 0.4.x | ✅ 活跃支持 |
| 0.3.x | ⚠️ 安全修复 |
| <0.3 | ❌ EOL |

---

## 相关文档

- [README](README.md) — 项目介绍
- [AGENTS.md](AGENTS.md) — 开发规范
- [CONTRIBUTING](CONTRIBUTING.md) — 贡献指南
- [ROADMAP](ROADMAP.md) — 路线图

---

最后更新: 2026-06-28
