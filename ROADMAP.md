# Roadmap — X-ReaderPlus

本文档记录 X-ReaderPlus 的功能规划与开发路线。

---

## v0.3.0 ✅ 已完成

- [x] Go 后端架构迁移（替代 Rust/Tauri）
- [x] 3 SQLite 数据库分离 (settings / content / meta)
- [x] REST API 17 端点
- [x] 12+ 格式解析（前端 Web Worker）
- [x] 全文搜索（中文分词）
- [x] 多色标注（高亮/下划线/笔记）
- [x] 书签系统
- [x] 回收站（删除保护+恢复）
- [x] 阅读统计 + 历史记录
- [x] 专注模式（遮罩+加粗）
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

---

## v0.4.0 🚧 计划中

- [ ] Go 后端格式解析器（减少前端依赖）
- [ ] EPUB3 完整支持（MathML, SVG, 多媒体）
- [ ] PDF 渲染优化（文本选择、缩放）
- [ ] 漫画模式（CBZ/CBT 双页浏览）
- [ ] 语音朗读（TTS Web Speech API）
- [ ] 词典增强（本地离线词典）
- [ ] 阅读模式（滚动/翻页/自动滚动）
- [ ] 自定义字体上传
- [ ] 批量元数据编辑
- [ ] 阅读计时器（番茄钟）

---

## v0.5.0 🔮 远期规划

- [ ] 系统托盘最小化
- [ ] 全局快捷键（即使窗口未聚焦）
- [ ] OPDS 书源支持
- [ ] 插件系统
- [ ] 移动端适配（PWA）
- [ ] 云同步（可选，端到端加密）
- [ ] 多语言完整翻译（英文/日文/韩文）
- [ ] 无障碍访问（屏幕阅读器支持）
- [ ] 触屏手势支持

---

## 贡献

欢迎提交 Issue 或 PR。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

最后更新: 2026-06-27
