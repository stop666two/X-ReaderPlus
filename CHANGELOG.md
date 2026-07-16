## v0.5.0

> 发布日期: 2026-07-15
> 深度性能优化与功能增强迭代。重写导入系统、专注模式、LibraryView，全面升级备份与加密体系。

---

## 🔒 安全修复

### 后端加固
- **CORS 白名单**: 反射任意 Origin → `http://127.0.0.1:34123` + `http://localhost:5173` 白名单
- **CSP 安全头**: 添加 Content-Security-Policy（script-src/style-src/font-src/img-src/connect-src/worker-src）
- **HTTP Method 校验**: 13 个 handler 全部添加 `default` 分支，未知 method 返回 405
- **SQL 双事务隔离**: `deleteBooks` 使用 Meta + Content 双事务，防止跨库不一致
- **路径遍历防护**: `ReadFile`/`FileSizes` 添加 `pathAllowed` 白名单 + 500MB 大小限制
- **数据库路径安全**: 数据目录禁用 `%APPDATA%`，仅存程序目录下
- **依赖安全**: `golang.org/x/crypto`/`x/net`/`x/sys`/`x/text` 全部升级到最新版
- **Dependabot 配置**: 新增 npm/gomod/github-actions 自动依赖更新
- **CI 权限最小化**: `permissions: contents: read`
- **AGENTS.md/审计报告清除**: 从全部 git 历史中彻底抹除敏感文件

### 前端安全
- **HTML 净化修复**: `ALLOWED_URI_REGEXP` 锚定错误导致所有链接被剥离 → 删除自定义正则，使用 DOMPurify 内建规则
- **`no-explicit-any` → warn**: ESLint 规则增强
- **`eqeqeq` 强制全等**: 修复 3 处 `==` 漏洞

---

## 🐛 Bug 修复

### 导入系统
- **280+ 文件选择卡死**:  Go 后端不再预读文件内容（只 stat）+ 浏览器模式使用 File API 按需读取
- **导入 200+ 列表卡死**: 文件列表只渲染前 20 个 + "还有 N 个" 提示
- **导入失败误报**: 去重文件（重复路径/重复内容）改为 `logger.info`，不再计入导入错误
- **导入结果弹窗统计补齐**: 显示 "共 N / 成功 M / 跳过 K / 失败 L" 完整统计
- **取消导入不清空**: 关闭/取消按钮调用 `resetImportState()` 清空 pendingFiles
- **导入完成数据不同步**: 导入后强制 `loadBookCount` + `loadBooks` + 重建 contentHash 索引
- **MD5 + SHA256 双哈希**: 先快速 MD5 预检，再 SHA-256 确认，加速重复检测
- **rawFile 400**: 仅保存 <5MB 的原始文件，大文件跳过

### 阅读器
- **专注模式跳顶卡死**: 全面重写 — `_focusIndex` 边界钳制 + `scrollIntoView` + 100ms 节流 + 移除全屏遮罩
- **专注模式聚焦消失**: CSS 简化（仅 opacity + box-shadow），移除昂贵的 font-weight/box-shadow transition
- **选段菜单误触发**: `handleSelection` 添加范围检查，仅在 reader 容器内处理
- **href 正则匹配 data-href**: 删除第三个无引号 case 的正则替换
- **标注渲染性能**: 单次 TreeWalker 预收集所有文本节点 → 批量操作减少回流

### 数据管理
- **LibraryView 卡片不更新**: `libraryStats` computed + `_dataVersion` 版本号强制重算
- **TagsView 页面空白**: `tagCache` 空时回退扫描本地 books，添加 `refreshTags()` 方法
- **笔记未标记源删除**: 笔记列表自动检测 `bookId` 是否存在，添加 "原文件已删除" chip
- **全部书库数量不同步**: `libItems` 改为 `totalBookCount`（API COUNT(*)）
- **删除后数量不更新**: `totalBookCount = books.length` → `loadBookCount()`
- **i18n 缺失**: 补充 `app.*` 系列 8 个翻译键（zh-CN + en-US）

### WebDAV
- **加密密码混淆**: 拆分为「服务器密码」(Basic Auth) + 「加密密码」(AES)，UI 清晰区分
- **加密方式选择**: 重构为完整面板（不加密/密码加密/对称密钥/非对称加密），含算法选择和一键生成
- **listBackups 加密后空**: 解密 base64 文件名后判断扩展名
- **配置文件加载修复**: `loadWebdavConfig`/`saveWebdavConfig` 独立处理

---

## ⚡ 性能优化

| 优化项 | 改进幅度 | 说明 |
|--------|---------|------|
| 导入文件选择 | **O(n)→O(1)** | Go+浏览器均不预读，按需流式读取 |
| 导入流式处理 | **O(n)→O(1) 内存** | 逐个 readFile + 立即处理，不再一次性全读 |
| loadBooks 分页 | **5000→50 本** | 启动只加载第一页，后台异步全量 |
| 标签聚合 | **客户端遍历→服务端 SQL** | 新增 `/api/tags` 端点，Go 端 JSON 解析 |
| 标签计数 | **O(n*m) 全量→cache** | `tagCache` 服务端聚合，UI 秒开 |
| 专注模式 | **大幅降低回流** | 无缓存查询 + `{ passive: true }` + 精简 CSS |
| 文件读取缓存 | **50→500 条** | 防止导入时溢出 |
| API 超时 30s | — | `AbortController` 防止无限挂起 |
| 邻居预加载 | **50→200ms** | 首屏渲染完成后再预加载邻接章节 |
| 书签/标注加载 | **异步非阻塞** | 不阻塞章节首屏渲染 |

---

## 🏗️ 构建与 CI/CD

- **`dev.bat` + `run-server.bat`**: 一键启动（杀进程 → 格式化数据库 → Go API → Vite 前端）
- **`go:embed` 修复**: 自动创建 `frontend/.gitkeep` 满足 embed 编译
- **build.yml 增强**: 添加 `lint-and-vet` job（npm lint + go vet + AGENTS.md PR 检测）
- **Dependabot.yml**: npm/gomod/github-actions 三通道自动更新
- **ESLint 配置**: 添加 `globals`（localStorage/confirm/AbortController/atob），规则增强
- **Vite 构建**: 显式 `sourcemap: false` + `minify: 'esbuild'`

---

## 🎨 UI/UX

- **导入对话框重构**: 三种模式 — 复制到现有书库 / 新建书库+选文件 / 新建书库+选文件夹
- **LibraryView 重写**: 宽卡片布局 + 底部翻页 + 标签聚合 + 自动刷新
- **书籍详情增强**: 标签搜索支持（`v-autocomplete` 输入即过滤）
- **设置页全面升级**:
  - 数据维护区：清除缓存/刷新元数据/清理无效/清除全部
  - 备份恢复区：分项选择 + 书库标记 + JSON5 格式 + 加密处理
  - WebDAV 加密面板：密码/AES密钥/非对称 + 算法选择 + 一键生成
- **番茄钟 + 白噪音**: ReaderView 工具栏集成
- **专注模式简化**: 移除全屏遮罩，改用段落级 box-shadow 高亮
- **笔记标记**: 已删除源文件的笔记自动标记 "原文件已删除"
- **`.env.example` + `.npmrc`**: 项目根目录配置模板

---

## 📦 依赖变更

| 依赖 | 版本 | 说明 |
|------|------|------|
| `golang.org/x/crypto` | latest | 安全升级（CVE-2023-48795 等） |
| `golang.org/x/net` | latest | 安全升级 |
| `@types/dompurify` | 移除 | dompurify v3 已自带类型声明 |
| node engine | ≥22.0.0 | vue-i18n → @intlify/core-base 要求 |

---

## v0.4.1

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
