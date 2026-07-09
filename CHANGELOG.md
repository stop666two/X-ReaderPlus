# X-ReaderPlus v0.4.1

> 发布日期: 2026-07-09
> 全量代码审计与修复迭代。修复 110+ 项安全、逻辑与性能问题，新增 10+ 项功能增强，全面升级构建与 CI/CD 流程。

---

## 📥 下载

| 平台 | 架构 | 文件 |
|------|------|------|
| 🪟 Windows | x64 (64位) | `X-ReaderPlus-win-x64.exe` |
| 🪟 Windows | x86 (32位) | `X-ReaderPlus-win-x86.exe` |
| 🪟 Windows | ARM64 | `X-ReaderPlus-win-arm64.exe` |
| 🍎 macOS | Intel | `X-ReaderPlus-mac-intel.dmg` |
| 🍎 macOS | Apple Silicon | `X-ReaderPlus-mac-apple.dmg` |
| 🐧 Linux | x86_64 | `X-ReaderPlus-linux-amd64` / `.AppImage` |
| 🐧 Linux | ARM64 | `X-ReaderPlus-linux-arm64` |

> **Windows**: 单文件便携版，无需安装，数据自动保存在 exe 同目录的 `data/` 下。
> **macOS**: `.dmg` 镜像，拖入 Applications 即可。
> **Linux**: 原生二进制或 `.AppImage`，`chmod +x` 后直接运行。

---

## 🔒 安全修复

### XSS 与内容安全
- **DOMPurify 集成**: ReaderView 的 `sanitizedContent` 计算属性静态导入 DOMPurify，严格白名单过滤所有 HTML 标签和属性。禁止 `ALLOW_DATA_ATTR`、`ADD_URI_SAFE_ATTR: ['src']` 确保 data: URI 不被误过滤
- **CSP 修复**: 保留 `'unsafe-inline'`（Vue/Vuetify/Wails 必须）；`connect-src` 添加 `ws:` `wss:` 协议支持
- **CORS 修复**: 改回无条件反射请求 Origin（服务仅绑 127.0.0.1，无外部访问风险）
- **安全响应头**: 添加 `X-Frame-Options: DENY`、`Referrer-Policy: no-referrer`、`Permissions-Policy`
- **`sanitize.ts` 改进**: `stripStyleUrls` 增加单引号匹配，移除正则预处理，完全依赖 DOMPurify

### 加密与认证
- **AES-256 密钥即时派生**: 移除 `exportKey`/`importKey` 持久化，密钥在 PIN 验证时从密码+盐值重新派生，仅缓存于会话内存
- **隐私锁密码绕过修复**: `removeBookLock`/`removeLibraryLock` 先验证密码再使用缓存密钥
- **隐私锁内存缓存**: `_libraryKeyCache`/`_bookKeyCache` 避免重复 PBKDF2；`setLibraryLock` 实际加密书籍章节
- **WebDAV 魔数头**: 加密数据添加 `XRPENC00` 8 字节魔数标识头替代脆弱长度判断
- **WebDAV 密钥持久化**: 导出 raw AES key 通过 API 存储，页面刷新自动恢复

### 请求安全
- **POST 体限制 10MB**: `decode` 函数添加 `http.MaxBytesReader(nil, r.Body, 10<<20)`（审计 C-1）

---

## 🐛 Bug 修复

### 数据与持久化
- **数据库迁移不再删除数据**: 删除原有的 `os.Remove()` 销毁模式，改为增量 `ALTER TABLE` 迁移
- **清除数据后默认书籍消失**: `handleClear` 调用 `db.RecreateDefaults()` 重建默认书库+示例书籍
- **滚动回顶部**: 拆分 `lazyContent` watcher 为章节切换(重置)和懒加载(不重置)
- **滚动进度除以零**: `Math.min(1, Math.max(0, st / scrollRange))` 防 NaN
- **`handleClear` 事务错误**: 所有 `tx.Exec` 检查错误并 Rollback
- **`handleClear` 遗漏 libraries 表**: 添加 `DELETE FROM libraries`
- **stats upsert 竞争**: 改为 SQLite 事务包裹
- **`bookUpdate` 竞态**: 改为单条 UPDATE 原子提交

### 删除与回收站
- **删除保留关联数据**: `deleteBooks` 仅删除书籍和章节，保留书签/标注/阅读历史（前端标记"已失效"）
- **回收站插入失败中止**: trash.insert 失败时中止全部删除（审计 H-015）
- **`handleAnnotationByID` 空 ID 检查**: 添加 `if id == ""` 校验

### 界面与交互
- **专注模式完全重写**: RAF 持续循环 60fps → 滚动居中段落导航 → 首尾段边界聚焦 → 过滤空白行
- **专注模式工具栏不可用**: 改为 2 秒快速隐藏
- **自动滚动可多次开启**: 加 `if (_autoTimer) return` 防重复
- **删除确认无法使用**: 文本输入改为两步按钮确认
- **图片加载失败**: `ADD_URI_SAFE_ATTR: ['src']` 跳过 src URI 校验
- **主题 JSON 输出错误**: 修复无效 JSON 输出（审计 H-008）
- **配置文件读取错误**: 修复 `handleConfig` 启发式 JSON 检测

### 标注
- **标注可跳转**: 新增 `scrollToAnnotation()` 支持同章/跨章跳转
- **笔记来源持久化**: localStorage 缓存 bookId→书名映射
- **`updateBook` 乐观更新顺序**: 先写 DB 再改内存（审计 H-016）

---

## ⚡ 性能优化

| 优化项 | 改进幅度 | 说明 |
|--------|---------|------|
| 文件缓存 LRU | 50条上限 | 替换无限增长数组，查找时自动提升 |
| 导入并发控制 | 50→3 | 防止导入时 OOM |
| 搜索索引写入 | 即时同步 | 移除 setTimeout 去抖，在锁内直接写入 |
| 搜索结果上限 | 200条 | 达到后停止搜索 |
| 搜索词长度限制 | 200字符 | 防止 SQLite LIKE 性能问题 |
| DJVU 字符串拼接 | O(N²)→O(N) | `raw +=` → `chars.push()` + `join()` |
| `toSnake` Unicode | 修复截断 | `byte(c)` → `b.WriteRune(c + 32)` |
| 搜索 API LIMIT | 100条 | 防止全表扫描 |

---

## 🏗️ 构建与 CI/CD

- **构建系统修复**: `npm run build:all` = vite build → copy-frontend → wails build，前端先复制到 `backend/frontend/`
- **`rebuild.bat`**: 支持 `--clean`，使用 `wails build` 后拷贝到 `dist/`
- **全平台构建更新**:
  - Windows x64/x86/ARM64 — 单文件便携 exe
  - macOS Intel + Apple Silicon — .dmg 打包
  - Linux amd64 (二进制+AppImage) + arm64 (二进制)
- **Release 自动发布**: 推送 tag 触发，按 windows/macos/linux 文件夹组织，正文从 CHANGELOG.md 提取

---

## 🎨 UI/UX

- **SVG 应用图标**: 蓝书+红X徽章，ICO/PNG 多尺寸统一
- **书库卡片重写**: 全宽布局 + 统计面板 + 操作栏
- **系统设置增强**: 缩托盘/通知/启动延迟/托盘行为
- **分页组件增强**: visiblePages/pageInfoText/pageSizeOptions
- **专注模式滚动居中**: 段落级导航，首尾自动聚焦

---

## 📋 审计报告统计

| 严重程度 | 总数 | 已处理 |
|---------|------|--------|
| 🔴 CRITICAL | 16 | 16 |
| 🟠 HIGH | 22 | 21 |
| 🟡 MEDIUM | 32 | 30 |
| 🔵 LOW | 32 | 28 |
| ⚪ INFO | 22 | 15 |
| **总计** | **124** | **~110** |

---

## 升级注意

- v0.3.x 用户直接替换 exe 即可，数据目录自动从 `%APPDATA%` 迁移到 `{exe_dir}/data/`
- 数据库 schema 自动迁移（v0→v2），无需手动操作
- WebDAV 加密密钥在首次使用新版本时需重新设置密码
- 强烈建议提前备份数据！！！防止出现未知错误！！！
