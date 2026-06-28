# Roadmap — X-ReaderPlus

本文档记录 X-ReaderPlus 的功能规划与开发路线。

---

## v0.3.0 ✅ 已完成

- [x] Go 后端架构迁移（替代 Rust/Tauri）
- [x] 3 SQLite 数据库分离 (settings / content / meta)
- [x] REST API 17 端点
- [x] 16 种格式解析（前端 Web Worker）
- [x] 全文搜索（中文分词）
- [x] 多色标注（高亮/下划线/笔记）
- [x] 书签系统
- [x] 回收站（删除保护+恢复）
- [x] 阅读统计 + 历史记录
- [x] 专注模式（遮罩+加粗)
- [x] 三主题（亮色/暗色/护眼）
- [x] WebDAV 加密备份
- [x] 标签管理
- [x] 书库管理
- [x] 阅读进度记忆与恢复
- [x] 原始格式导出
- [x] GitHub Actions 全平台构建
- [x] 全平台打包 (Win: NSIS Setup / Mac: DMG / Linux: AppImage)
- [x] 前端嵌入 Go 二进制单文件发布
- [x] WebView2/WebKit/GTK 原生窗口壳
- [x] Windows 无边框窗口 + Vue 自绘标题栏 + 最小/最大/关闭控制

## v0.3.1 ✅ 已完成

- [x] 新增 5 种格式：PRC、PDB、CHM、LIT、LRF
- [x] 安全修复：`clearAllHistory` / `clearAllStats` 改用专用 DELETE 端点
- [x] 功能修复：LIT 格式作者信息正常提取
- [x] 修复：LibraryView v-if 条件表达式
- [x] 修复：PinUnlockView 定时器泄漏
- [x] 修复：笔记操作 API 失败时的数据回滚
- [x] 修复：TAR 漫画解析图片大小限制
- [x] 性能：`arrayToDataUrl` O(n²) → `arrayBufferToBase64` 分块编码
- [x] 性能：`stats.ts` 原子 upsert 端点消除竞态
- [x] 代码质量：ESLint v9 + Prettier
- [x] 代码质量：清理死代码
- [x] 构建：版本号统一、脚本路径修复

## v0.4.0 ✅ 已完成

- [x] **禁用 MOBI/AZW3/PRC/PDB** — 解析不稳定，从白名单移除
- [x] **格式白名单** — `ALLOWED_FORMATS` 闸门，17 种格式，禁止格式给出转换提示
- [x] **三阅读模式** — 滚动 / 翻页（点击+键盘←→） / 自动滚屏（可调速度）
- [x] **专注模式重写** — 全屏暗化遮罩 + 聚焦段落阴影辉光 + 滚动实时感知
- [x] **自定义字体上传** — 支持 .ttf/.otf/.woff/.woff2，自动注入 @font-face
- [x] **外部链接** — WebView2 ShellExecute 打开系统默认浏览器
- [x] **EPUB TOC 导航修复** — NCX/nav 目录映射到实际章节索引，支持 href 片段跳转
- [x] **代码清理** — 移除 mo bi 相关类型、死代码、未使用依赖
- [x] **文档全面更新** — README / ROADMAP / AGENTS 同步当前状态

---

## v0.5.0 🚧 计划中

> **优先级**: P0 = 核心体验 / P1 = 增强功能 / P2 = 锦上添花

- [ ] [P0] PDF 文本选择与缩放优化
- [ ] [P1] EPUB3 完整支持（MathML, SVG 多媒体）
- [ ] [P1] 词典增强（本地离线词典）
- [ ] [P1] Go 后端格式解析器（减少前端依赖）
- [ ] [P2] 漫画模式双页浏览
- [ ] [P2] 语音朗读（TTS Web Speech API）
- [ ] [P2] 批量元数据编辑
- [ ] [P2] 阅读计时器（番茄钟）

---

## v0.6.0 🔮 远期规划

- [ ] 系统托盘最小化
- [ ] 全局快捷键（窗口未聚焦）
- [ ] OPDS 书源支持
- [ ] 插件系统
- [ ] 移动端适配（PWA）
- [ ] 云同步（可选，端到端加密，需用户主动配置）
- [ ] 多语言完整翻译（英文/日文/韩文）
- [ ] 无障碍访问（屏幕阅读器）
- [ ] 触屏手势支持

---

## 贡献

欢迎提交 Issue 或 PR。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

最后更新: 2026-06-28
