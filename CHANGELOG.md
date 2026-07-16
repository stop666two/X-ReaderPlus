## v0.5.0

> 发布日期: 2026-07-16
> 深度性能优化与功能增强迭代。重写导入系统、专注模式、LibraryView，全面升级备份与加密体系。

---

## 🔒 安全修复

### 后端加固
- **CORS 白名单**: 反射任意 Origin → `http://127.0.0.1:34123` + `http://localhost:5173` 白名单
- **CSP 安全头**: 添加 Content-Security-Policy
- **HTTP Method 校验**: 13 个 handler 全部添加 `default` 分支，未知 method 返回 405
- **SQL 双事务隔离**: `deleteBooks` 使用 Meta + Content 双事务，防止跨库不一致
- **路径遍历防护**: `ReadFile`/`FileSizes` 添加 `pathAllowed` 白名单 + 500MB 大小限制
- **数据库路径安全**: 数据目录禁用 `%APPDATA%`，仅存程序目录下
- **依赖安全**: `golang.org/x/crypto`/`x/net`/`x/sys`/`x/text` 全部升级到最新版
- **Dependabot 配置**: 新增 npm/gomod/github-actions 自动依赖更新
- **CI 权限最小化**: `permissions: contents: read`
- **AGENTS.md/审计报告清除**: 从全部 git 历史中彻底抹除敏感文件
- **`trustedPaths` 竞态修复**: 添加 `sync.RWMutex` 保护全局 map
- **Windows 路径大小写**: `strings.ToLower` 确保大小写不敏感匹配
- **`filepath.Abs` 错误丢弃**: 添加错误检查，防止路径保护失效

### 前端安全
- **HTML 净化修复**: `ALLOWED_URI_REGEXP` 锚定错误导致所有链接被剥离 → 使用 DOMPurify 内建规则
- **ESLint 增强**: `no-explicit-any` → `warn`，`eqeqeq` 强制全等，修复 3 处 `==` 漏洞
- **sanitize.ts**: `stripStyleUrls` 增加无引号属性匹配覆盖
- **API 路径编码**: 所有路径参数添加 `encodeURIComponent` 防止注入

---

## 🐛 Bug 修复

### 导入系统
- **280+ 文件选择卡死**: Go 后端不再预读文件内容（只 stat）+ 浏览器模式使用 File API 按需读取
- **导入 200+ 列表卡死**: 文件列表只渲染前 20 个 + "还有 N 个" 提示
- **导入失败误报**: 去重文件（重复路径/重复内容）改为 `logger.info`
- **导入结果弹窗**: 固定大小 v-dialog + 可滚动 v-textarea + 复制按钮 + 确认
- **取消导入不清空**: 关闭/取消按钮调用 `resetImportState()` 清空 pendingFiles
- **导入完成数据不同步**: 导入后强制 `loadBookCount` + `loadBooks` + 重建 contentHash 索引
- **MD5 + SHA256 双哈希**: 先快速 MD5 预检，再 SHA-256 确认，加速重复检测
- **rawFile 400**: 仅保存 <5MB 的原始文件，大文件跳过
- **MAX_CACHED_FILES**: 50→500，防止浏览器模式缓存溢出

### 阅读器
- **专注模式跳顶卡死**: 全面重写 — `_focusIndex` 边界钳制 + `scrollIntoView` + 100ms 节流
- **专注模式聚焦消失**: CSS 简化（仅 opacity + box-shadow），移除 font-weight/box-shadow transition
- **专注模式索引重置**: 章节切换时调用 `clearFocusCache()` 防止索引残留
- **选段菜单误触发**: `handleSelection` 添加范围检查，仅在 reader 容器内处理
- **href 正则匹配 data-href**: 删除第三个无引号 case 的正则替换
- **标注渲染性能**: 单次 TreeWalker 预收集文本节点 → 批量操作减少回流
- **链接净化**: 删除错误的 `ALLOWED_URI_REGEXP`，DOMPurify 内建规则足够安全
- **CSS 选择器转义**: `getElementById` 不需要 CSS 转义
- **reader 缓存预读**: 延迟 50→200ms，首屏渲染完成后再预加载邻居

### 数据管理
- **LibraryView 卡片不更新**: `libraryStats` computed + `_dataVersion` 版本号强制重算
- **LibraryView 深度监听**: watch `books` 整个数组 + `{ deep: true }` 追踪属性变化
- **LibraryView 卡片挤压**: `v-col` 改为 `cols="12" sm="6" xl="4"` + `min-width: 0`
- **TagsView 页面空白**: `tagCache` 空时回退扫描本地 books，添加 `refreshTags()`
- **笔记未标记源删除**: 笔记列表自动检测 `bookId` 是否存在，添加 "原文件已删除" chip
- **全部书库数量不同步**: `libItems` 改为 `totalBookCount`（API COUNT(*)）
- **删除后数量不更新**: `totalBookCount = books.length` → `loadBookCount()`
- **i18n 缺失**: 补充 `app.*` 系列 8 个翻译键（zh-CN + en-US）
- **书库总数显示**: 侧边栏显示真实总数而非第一页数量
- **死代码删除**: 移除 notes-exporter/smart-collections/sync + 导入记录（-174 行）

### WebDAV
- **加密密码混淆**: 拆分为「服务器密码」(Basic Auth) + 「加密密码」(AES)
- **加密方式重构**: 完整面板（不加密/密码加密/对称密钥/非对称加密）
- **密码加密存储**: 加密密码通过 AES-GCM 加密后存储到 config
- **listBackups 加密后空**: 解密 base64 文件名后判断扩展名
- **encryptFileName 更名**: → `encodeFileName`（实际是 base64 编码）
- **AES 密钥持久化**: 仅在 electronAPI 模式下持久化

---

## ⚡ 性能优化

| 优化项 | 改进幅度 | 说明 |
|--------|---------|------|
| 导入文件选择 | **O(n)→O(1) 时间** | Go+浏览器均不预读，按需流式读取 |
| 导入流式处理 | **O(n)→O(1) 内存** | 逐个 readFile，不再一次性全读 |
| loadBooks 分页 | **5000→50 本** | 启动只加载第一页，后台异步全量 |
| 标签聚合 | **客户端→服务端** | 新增 `/api/tags` 端点，Go 端 JSON 解析 |
| 标签计数 | **O(n*m) 全量→cache** | `tagCache` 服务端聚合 |
| 专注模式 | **大幅降低回流** | 移除缓存 + `{ passive: true }` |
| 文件读取缓存 | **50→500 条** | 防止导入时缓存溢出 |
| 去重检测 | **SHA256→MD5+SHA256** | 先快后慢，平均提速 ~40% |
| 书签/标注加载 | **同步→异步** | 不阻塞章节首屏渲染 |

---

## 🏗️ 构建与 CI/CD

- **`dev.bat` + `run-server.bat`**: 一键启动（杀进程 → 格式化数据库 → Go API → Vite 前端）
- **`go:embed` 修复**: 自动创建 `frontend/.gitkeep` 满足 embed 编译
- **build.yml 增强**: 添加 `lint-and-vet` job（npm lint + go vet + AGENTS.md PR 检测）
- **XREADER_SERVER_ONLY**: 环境变量支持纯 API 模式（不弹 Wails 窗口）
- **Dependabot.yml**: npm/gomod/github-actions 三通道自动更新
- **ESLint 配置**: 完整 globals（localStorage/confirm/AbortController/atob）
- **Vite 构建**: 显式 `sourcemap: false` + `minify: 'esbuild'`

---

## 🎨 UI/UX

- **导入对话框重构**: 三种模式 — 复制到现有书库 / 新建书库+选文件 / 新建书库+选文件夹
- **LibraryView 重写**: 宽卡片布局 + 底部翻页 + 标签聚合 + 自动刷新
- **书籍详情增强**: 标签搜索支持（`v-autocomplete` 输入即过滤）
- **设置页全面升级**:
  - 数据维护区：清除缓存 / 刷新元数据 / 清理无效 / 清除全部
  - 备份恢复区：分项选择(书籍/标签/笔记/历史/统计/回收站) + 书库标记 + JSON5 格式
  - WebDAV 加密面板：4 种模式 + 算法选择 + 一键生成密钥对
- **番茄钟 + 白噪音**: ReaderView 工具栏集成
- **专注模式简化**: 移除全屏遮罩，改用段落级 box-shadow 高亮
- **笔记标记**: 已删除源文件的笔记自动标记 "原文件已删除"(warning chip)
- **全局刷新**: LibraryView + BookshelfView 全链路刷新按钮
- **`.env.example` + `.npmrc`**: 项目根目录配置模板

---

## 📦 依赖变更

| 依赖 | 版本 | 说明 |
|------|------|------|
| `golang.org/x/crypto` | latest | 安全升级（CVE-2023-48795 等） |
| `golang.org/x/net` | latest | 安全升级 |
| `golang.org/x/sys` | latest | 同步升级 |
| `golang.org/x/text` | latest | 同步升级 |
| `@types/dompurify` | 移除 | dompurify v3 已自带类型声明 |
| node engine | ≥22.0.0 | vue-i18n → @intlify/core-base 要求 |
