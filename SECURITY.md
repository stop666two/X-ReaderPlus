# Security Policy

## 报告漏洞

如发现安全漏洞，请 **不要** 创建公开 Issue。请通过 [GitHub Security Advisories](https://github.com/stop666two/X-ReaderPlus/security/advisories/new) 私密提交。

### 披露时间线

- 收到报告后 **48 小时** 内确认
- **7 天** 内完成评估和修复方案
- 修复发布后 **30 天** 公开披露细节

## 安全架构

### 数据存储

- **3 SQLite 数据库分离**: `settings.db` / `content.db` / `meta.db`
- **存储路径**: exe 同目录下的 `data/`（便携式，复制 exe 即可迁移）
- 可选 AES-256-GCM 加密 + PBKDF2 60 万次迭代
- WAL 模式 + `SetMaxOpenConns(1)` 确保数据完整性

### 网络安全

- **零网络请求**（除词典 API `api.dictionaryapi.dev`）
- 服务仅绑定 **127.0.0.1:34123**（不接受外部连接）
- CORS 反射请求 Origin（仅本地客户端可达，无外部访问风险）
- HTTP 安全头:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### 请求保护

- POST/PUT 请求体限制 **10MB**（`http.MaxBytesReader`）
- 搜索词长度限制 **200 字符**
- 搜索结果上限 **200 条**

### WebDAV 备份加密

- 文件内容: AES-256-GCM 加密，**8 字节魔数头 `XRPENC00`** + 12 字节随机 IV
- 密钥持久化: 导出 raw AES key 通过 API 存储至 SQLite
- 页面刷新自动恢复密钥

### HTML 内容安全（XSS 防护）

- **DOMPurify** 白名单过滤（ReaderView 中直接调用）
- 允许标签: h1-h6, p, br, hr, b, i, em, strong, u, s, mark, small, sub, sup, ul, ol, li, blockquote, pre, code, a, img, span, div, table, thead, tbody, tr, th, td, figure, figcaption
- 允许属性: href, src, alt, title, class, id, width, height, style
- 禁止: script, style, iframe, object, embed, link, meta, base, form, svg
- `javascript:` 协议 → `blocked:`
- `on*` 事件处理器全部移除
- CSS `url()` 全部替换为 `none`

### PIN 锁

- 4 位以上数字
- **阶梯式锁定**: 5 次 → 30s / 15 次 → 5min
- PBKDF2-SHA256 60 万次迭代 + 32 字节随机盐
- **常量时间比较** (timing-safe)
- AES-256 密钥**会话级缓存**（不持久化到磁盘）
- 每次导航均检查 PIN（无缓存绕过）

### 文件操作安全

- `ReadFile`: 路径来自 OS 文件对话框（用户发起，无 XSS 风险）
- `FileSizes`: 同上，用户选择的文件路径
- `SaveFile`: 使用 OS 保存对话框，路径由用户选择
- `OpenExternal`: 仅允许 `http://` / `https://` / `mailto:` 协议

### 加密常量

| 参数 | 值 |
|------|-----|
| PBKDF2 迭代 | 600,000 |
| AES 密钥 | 256 位 (GCM) |
| IV 长度 | 12 字节 |
| 盐长度 | 32 字节 |

## 版本支持

| 版本 | 状态 |
|------|------|
| 0.4.x | ✅ 活跃支持 |
| 0.3.x | ⚠️ 安全修复 |
| < 0.3 | ❌ EOL |

## 相关文档

- [README](README.md) — 项目介绍
- [AGENTS.md](AGENTS.md) — 开发规范
- [CONTRIBUTING](CONTRIBUTING.md) — 贡献指南
- [ROADMAP](ROADMAP.md) — 路线图
- [CHANGELOG.md](CHANGELOG.md) — 版本记录

---

最后更新: 2026-07-09
