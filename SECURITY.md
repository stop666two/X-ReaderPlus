# Security Policy

## 报告漏洞

如发现安全漏洞，请 **不要** 创建公开 Issue。

请发送邮件到项目作者，我们会尽快处理。

## 安全架构

### 数据存储

- **3 SQLite 数据库分离**: settings / content / meta
- 数据库文件存储在 `%APPDATA%/x-reader-plus/` (Windows) 或 `~/.config/x-reader-plus/` (Linux/macOS)
- 可选 AES-256-GCM 数据库加密
- PIN 锁使用 PBKDF2-SHA256 (60 万次迭代) + 随机盐

### 网络安全

- **零网络请求** (除词典 API `api.dictionaryapi.dev`)
- 严格 CSP: 禁止内联脚本、禁止跨域
- WebDAV 备份: AES-256-GCM 端到端加密
  - 文件名 URL-safe base64 混淆
  - 文件内容 AES-256-GCM (随机 IV 前置)
  - 密钥 PBKDF2 派生 (仅存盐，不存密钥)

### 认证

- PIN 锁: 4+ 位数字，失败升级
  - 5 次失败 → 30 秒锁定
  - 10 次失败 → 300 秒锁定
- 隐私锁: 8+ 位密码 (大小写+数字)，PBKDF2 + 速率限制

## 依赖项

保持依赖项更新，使用 `npm audit` 和 `go mod tidy` 定期检查。

## 版本支持

| 版本 | 状态 |
|------|------|
| 0.3.x | ✅ 活跃支持 |

---

## 相关文档

- [README](README.md) — 项目介绍
- [AGENTS.md](AGENTS.md) — 开发规范
- [CONTRIBUTING](CONTRIBUTING.md) — 贡献指南
- [ROADMAP](ROADMAP.md) — 路线图

---

最后更新: 2026-06-27
