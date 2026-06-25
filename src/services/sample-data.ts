import type { Book, ChapterContent } from '@/types'
import { DEFAULT_LIBRARY_ID } from '@/constants'

const SAMPLE_BOOK_ID = 'sample-book-001'

export function createSampleBook(): Book {
  return {
    id: SAMPLE_BOOK_ID,
    title: 'X-ReaderPlus 使用指南',
    author: 'X-ReaderPlus 团队',
    cover: '',
    path: '',
    format: 'markdown',
    size: 0,
    addedAt: Date.now(),
    lastReadAt: Date.now(),
    progress: 0,
    chapterIndex: 0,
    chapterProgress: 0,
    tags: ['指南', '入门'],
    rating: 4,
    review: '一本详细的功能使用指南，帮助您快速上手 X-ReaderPlus。',
    wordCount: 500,
    chapterCount: 7,
    totalReadingTime: 0,
    libraryId: DEFAULT_LIBRARY_ID
  }
}

export function createSampleChapters(): ChapterContent[] {
  return [
    {
      title: '第一章：欢迎使用 X-ReaderPlus',
      content: `<h1>欢迎使用 X-ReaderPlus</h1>
<p>X-ReaderPlus 是一款<strong>完全脱机</strong>的现代化多格式阅读器，致力于为您提供纯粹、安全、高效的阅读体验。无需联网，所有数据本地存储，让您的阅读隐私得到充分保护。</p>

<h2>设计理念</h2>
<ul>
<li><strong>完全脱机</strong>：不依赖任何在线服务，所有功能本地执行</li>
<li><strong>隐私至上</strong>：本地数据库 + AES-256-GCM 加密，阅读记录只有您自己知道</li>
<li><strong>性能优先</strong>：采用 IndexedDB + 虚拟滚动技术，轻松处理数万本藏书</li>
<li><strong>美观实用</strong>：三主题（明亮/暗黑/护眼）、多维度自定义，打造专属阅读环境</li>
</ul>

<h2>核心特性一览</h2>
<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse;">
<tr style="background:#f0f0f0;"><th>特性分类</th><th>功能详情</th></tr>
<tr><td>📚 多格式支持</td><td>EPUB、TXT、Markdown、HTML、MOBI、AZW3、FB2、DJVU、DOCX、RTF、ODT、PDF、CBR/CBZ/CBT/CB7</td></tr>
<tr><td>📖 强大阅读器</td><td>分章节阅读、多导航模式、可调排版、三主题切换、缩放字号</td></tr>
<tr><td>✍️ 标注与笔记</td><td>6色高亮标注、行内笔记、多层级书签、全文搜索标注</td></tr>
<tr><td>🔒 安全保护</td><td>PIN码锁定、SHA-256+PBKDF2(60万次迭代)、AES-256-GCM加密</td></tr>
<tr><td>📊 阅读统计</td><td>阅读时长追踪、进度热力图、阅读速度分析、阅读日历</td></tr>
<tr><td>🗂️ 书库管理</td><td>多书库支持、复制导入/文件夹引用双模式、批量操作</td></tr>
<tr><td>🔍 内置词典</td><td>词语查询、释义展示、标注导出</td></tr>
<tr><td>⌨️ 快捷键</td><td>丰富的键盘快捷键，提升操作效率</td></tr>
</table>

<h2>适用场景</h2>
<ul>
<li>阅读 EPUB、PDF 等格式的电子书</li>
<li>管理和阅读大量本地 TXT/Markdown 文档</li>
<li>学习笔记整理与标注管理</li>
<li>离线文献阅读与研究</li>
<li>漫画阅读（CBR/CBZ 格式）</li>
</ul>

<p style="margin-top:1.5em; padding:12px; background:#f8f8ff; border-left:4px solid #7C3AED; border-radius:0 8px 8px 0;">
<strong>💡 提示</strong>：本指南将带您逐一了解 X-ReaderPlus 的各项功能。建议按顺序阅读，也可以直接跳到您感兴趣的章节。
</p>`
    },
    {
      title: '第二章：导入与管理您的藏书',
      content: `<h1>导入与管理您的藏书</h1>

<h2>新建书库</h2>
<p>X-ReaderPlus 支持<strong>多书库管理</strong>，您可以将不同类型的书籍分类到不同书库中。点击左侧导航栏的"新建书库"按钮，有以下两种模式：</p>

<h3>模式一：复制导入</h3>
<p>选择此模式后，系统会将您选择的文件<strong>复制</strong>到 X-ReaderPlus 的数据目录中。原文件不受影响，删除原文件不会影响阅读。</p>
<ul>
<li><strong>优点</strong>：书籍数据独立管理，不受原文件变动影响</li>
<li><strong>适用</strong>：长期收藏、重要文档</li>
</ul>

<h3>模式二：选择文件夹</h3>
<p>选择此模式后，系统直接<strong>引用</strong>您选择的文件夹。文件夹内的支持格式文件会被自动扫描添加。</p>
<ul>
<li><strong>优点</strong>：无需复制，节省磁盘空间；文件夹内新增书籍自动同步</li>
<li><strong>适用</strong>：已有书籍文件夹、临时浏览</li>
</ul>

<h2>添加书籍</h2>
<p>在书架页面，您可以通过以下方式添加书籍：</p>
<ol>
<li><strong>拖拽导入</strong>：直接将文件拖入书架区域</li>
<li><strong>按钮导入</strong>：点击右上角的"+"按钮，选择文件</li>
<li><strong>批量导入</strong>：一次性选择多个文件，系统会自动识别格式</li>
</ol>

<h2>书籍管理操作</h2>
<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse;">
<tr style="background:#f0f0f0;"><th>操作</th><th>说明</th></tr>
<tr><td>🔍 搜索</td><td>支持按书名、作者名搜索，结果实时过滤</td></tr>
<tr><td>🏷️ 标签</td><td>为书籍添加多个标签，可按标签分类浏览</td></tr>
<tr><td>⭐ 评分</td><td>1-5星评分，快速标记您的喜好程度</td></tr>
<tr><td>📝 点评</td><td>为每本书添加简短的阅读评价</td></tr>
<tr><td>🗑️ 删除</td><td>删除书籍（进入回收站，可恢复或永久删除）</td></tr>
<tr><td>📋 详情</td><td>查看书籍元数据：字数、格式、阅读进度等</td></tr>
</table>

<h2>支持的文件格式</h2>
<ul>
<li><strong>EPUB</strong> (.epub) — 主流电子书格式，支持目录、图片、CSS 样式</li>
<li><strong>MOBI / AZW3</strong> (.mobi, .azw3) — Kindle 电子书格式</li>
<li><strong>PDF</strong> (.pdf) — 便携文档格式，保留原始排版</li>
<li><strong>TXT</strong> (.txt) — 纯文本，自动分章节</li>
<li><strong>Markdown</strong> (.md) — 结构化文本，支持代码高亮</li>
<li><strong>HTML</strong> (.html, .htm) — 网页格式</li>
<li><strong>FB2</strong> (.fb2) — FictionBook 格式</li>
<li><strong>DJVU</strong> (.djvu) — 扫描文档格式</li>
<li><strong>DOCX / RTF / ODT</strong> — 办公文档格式</li>
<li><strong>CBR / CBZ / CBT / CB7</strong> — 漫画压缩包格式</li>
</ul>

<p style="margin-top:1.5em; padding:12px; background:#fff8e1; border-left:4px solid #F59E0B; border-radius:0 8px 8px 0;">
<strong>⚠️ 注意</strong>：大文件（如 PDF 扫描版、高分辨率漫画）的解析可能需要一些时间，请耐心等待。导入进度会在书架页面显示。
</p>`
    },
    {
      title: '第三章：阅读器功能详解',
      content: `<h1>阅读器功能详解</h1>

<h2>进入阅读模式</h2>
<p>在书架页面点击任意书籍封面或书名，即可进入阅读器。阅读器是 X-ReaderPlus 的核心界面，提供丰富的阅读功能和自定义选项。</p>

<h2>阅读导航</h2>
<h3>章节导航</h3>
<ul>
<li><strong>← → 方向键</strong>：上一章 / 下一章</li>
<li><strong>PageUp / PageDown</strong>：向上翻页 / 向下翻页</li>
<li><strong>Space 空格键</strong>：向下翻页</li>
<li><strong>Home / End</strong>：跳到章节开头 / 末尾</li>
<li><strong>左侧目录面板</strong>：点击目录项直接跳转到对应章节</li>
</ul>

<h3>进度追踪</h3>
<ul>
<li>底部进度条：显示当前章节内的阅读位置</li>
<li>章节进度百分比：精确到 0.1%</li>
<li>总体阅读进度：在书架页面显示每本书的整体进度</li>
</ul>

<h2>排版自定义</h2>
<p>阅读器提供丰富的排版设置，可在右上角工具栏中随时调整：</p>

<h3>字体设置</h3>
<ul>
<li><strong>字号</strong>：12px ~ 32px 可调，支持 Ctrl+滚轮快速缩放</li>
<li><strong>字号缩放</strong>：-50% ~ +100% 微调</li>
<li><strong>字体</strong>：系统默认 / 衬线 / 无衬线 / 等宽，支持自定义 CSS 字体</li>
<li><strong>字重</strong>：300（细体）~ 700（粗体）</li>
</ul>

<h3>段落设置</h3>
<ul>
<li><strong>行距</strong>：1.2 ~ 3.0 倍行距</li>
<li><strong>段距</strong>：0 ~ 40px 段落间距</li>
<li><strong>缩进</strong>：0 ~ 4em 首行缩进</li>
<li><strong>对齐</strong>：两端对齐 / 左对齐</li>
<li><strong>边距</strong>：0 ~ 64px 水平边距</li>
<li><strong>页面宽度</strong>：600px ~ 1200px 内容区域宽度</li>
</ul>

<h2>三主题切换</h2>
<p>点击右上角主题按钮（或按 <kbd>Ctrl+T</kbd>）循环切换三种阅读模式：</p>
<ul>
<li><strong>☀️ 明亮模式</strong>：白底黑字，适合白天光照充足环境</li>
<li><strong>🌙 暗黑模式</strong>：深色背景浅色文字，减少眼睛疲劳，适合夜间阅读</li>
<li><strong>🖌️ 护眼模式</strong>：暖黄色仿纸质背景，长时间阅读更舒适</li>
</ul>

<h2>高级功能</h2>
<ul>
<li><strong>自动滚屏</strong>：解放双手，阅读器自动匀速滚动。速度 10~100 可调</li>
<li><strong>工具栏自动隐藏</strong>：阅读时工具栏自动隐藏，沉浸式体验。延迟 1~10 秒可调</li>
<li><strong>英文断字</strong>：开启 Hyphenation，英文单词在行尾自动断字，排版更均匀</li>
<li><strong>背景图片</strong>：支持自定义背景图片 URL，打造个性化阅读环境</li>
<li><strong>自定义 CSS</strong>：高级用户可输入自定义 CSS 样式，完全掌控阅读区外观</li>
</ul>

<h2>阅读统计</h2>
<p>阅读器会追踪您的阅读行为并生成统计数据：</p>
<ul>
<li>单本书阅读时长（精确到秒）</li>
<li>阅读速度估算（字数/分钟）</li>
<li>最后阅读时间记录</li>
<li>可在"统计"页面查看全局阅读数据分析</li>
</ul>

<p style="margin-top:1.5em; padding:12px; background:#e8f5e9; border-left:4px solid #43A047; border-radius:0 8px 8px 0;">
<strong>💡 小技巧</strong>：使用 <kbd>Ctrl + 滚轮</kbd> 可以快速调整字号大小，无需打开设置面板。在全屏阅读时，移动鼠标到屏幕顶部可以唤出隐藏的工具栏和菜单。
</p>`
    },
    {
      title: '第四章：标注、笔记与书签',
      content: `<h1>标注、笔记与书签</h1>

<h2>高亮标注</h2>
<p>X-ReaderPlus 提供<strong>6种颜色</strong>的高亮标注功能，帮助您标记重要内容：</p>

<h3>如何标注</h3>
<ol>
<li>在阅读器中<strong>选中文字</strong></li>
<li>在弹出的浮动工具栏中选择<strong>高亮颜色</strong></li>
<li>支持的颜色：🟡 黄色、🟠 橙色、🔴 红色、🔵 蓝色、🟢 绿色、🟣 紫色</li>
</ol>

<h3>管理标注</h3>
<ul>
<li><strong>查看</strong>：所有标注汇总在"笔记"页面，按书分类展示</li>
<li><strong>筛选</strong>：可按颜色筛选标注，快速定位特定类型的标记</li>
<li><strong>编辑</strong>：点击标注可查看上下文，修改颜色或删除</li>
<li><strong>搜索</strong>：在笔记页面搜索关键词，找到包含该词的所有标注</li>
</ul>

<h2>行内笔记</h2>
<p>除了高亮，您还可以为任何标注添加<strong>文字笔记</strong>：</p>
<ol>
<li>选中文字并高亮后，在弹出的工具栏中点击"笔记"按钮</li>
<li>输入您的想法、疑问或总结</li>
<li>笔记会附加在该高亮标注上，在"笔记"页面可以统一查看</li>
</ol>

<h3>笔记的使用建议</h3>
<ul>
<li>使用不同颜色标记不同类型的内容（如：黄色=重要概念，蓝色=待查资料，绿色=个人感悟）</li>
<li>为每个高亮添加简短笔记，方便日后回顾</li>
<li>定期在"笔记"页面浏览和整理标注</li>
</ul>

<h2>书签</h2>
<p>书签是快速定位重要页面的工具：</p>

<h3>添加书签</h3>
<ul>
<li><strong>快捷键</strong>：在阅读器中按 <kbd>Ctrl+D</kbd> 添加/删除当前页书签</li>
<li><strong>按钮</strong>：点击工具栏中的书签图标</li>
</ul>

<h3>管理书签</h3>
<ul>
<li>书签列表可在阅读器侧边栏查看</li>
<li>点击书签项直接跳转到对应位置</li>
<li>支持为书签添加描述性标题</li>
<li>删除不再需要的书签</li>
</ul>

<h2>内容搜索</h2>
<ul>
<li><strong>章节内搜索</strong>：按 <kbd>Ctrl+F</kbd> 打开搜索面板，在当前章节中查找文本</li>
<li><strong>搜索结果高亮</strong>：匹配的文本会在页面上高亮显示</li>
<li><strong>结果导航</strong>：使用 ↑↓ 键在搜索结果间跳转</li>
</ul>

<p style="margin-top:1.5em; padding:12px; background:#f3e5f5; border-left:4px solid #9C27B0; border-radius:0 8px 8px 0;">
<strong>🎯 高效标注策略</strong>：建议第一次通读时不做标注，第二遍精读时再系统性地标注重要内容。这样能避免"什么都重要"的标注膨胀问题。
</p>`
    },
    {
      title: '第五章：安全与隐私保护',
      content: `<h1>安全与隐私保护</h1>

<h2>完全脱机运行</h2>
<p>X-ReaderPlus 的核心理念是<strong>完全离线</strong>。应用不需要任何网络权限即可正常运行：</p>
<ul>
<li>不连接任何远程服务器</li>
<li>不收集任何用户数据</li>
<li>不发送任何遥测信息</li>
<li>所有功能本地执行，响应迅速</li>
</ul>

<h2>PIN 码保护</h2>
<p>您可以在"设置 → 安全"中启用 PIN 码保护，为您的阅读数据加上一道锁：</p>

<h3>PIN 码特性</h3>
<ul>
<li><strong>长度</strong>：4-32 位字符</li>
<li><strong>加密</strong>：SHA-256 + PBKDF2（60万次迭代）哈希保护</li>
<li><strong>锁定机制</strong>：连续 5 次输入错误，锁定 30 秒</li>
<li><strong>应用锁定</strong>：启动时需输入 PIN 码才能访问</li>
</ul>

<h3>PIN 码操作</h3>
<ul>
<li><strong>设置</strong>：输入新 PIN 码并确认</li>
<li><strong>修改</strong>：输入当前 PIN 码后设置新 PIN 码</li>
<li><strong>关闭</strong>：验证当前 PIN 码后关闭保护</li>
<li><strong>重置</strong>：通过预设的安全问题找回/重置 PIN 码</li>
</ul>

<h2>安全问题</h2>
<p>为防止忘记 PIN 码导致数据无法访问，建议设置安全问题：</p>
<ol>
<li>选择一个安全问题（或自定义问题）</li>
<li>输入只有您知道的答案（答案会经过哈希加密存储）</li>
<li>忘记 PIN 码时，通过回答安全问题重置密码</li>
</ol>

<h2>数据加密存储</h2>
<p>X-ReaderPlus 使用多层加密保护您的数据：</p>
<ul>
<li><strong>AES-256-GCM</strong>：高级加密标准，256位密钥，带完整性校验</li>
<li><strong>PBKDF2</strong>：密码基密钥派生函数，对抗暴力破解</li>
<li><strong>SHA-256</strong>：安全哈希算法，PIN码和答案均不可逆存储</li>
<li><strong>本地 IndexedDB</strong>：浏览器标准本地数据库，数据仅存在于您的设备</li>
</ul>

<h2>数据备份与恢复</h2>
<p>定期备份是数据安全的最佳实践：</p>
<h3>导出备份</h3>
<ul>
<li>在"设置 → 数据管理"中点击"导出备份"</li>
<li>备份包含：所有书籍元数据、章节内容、标注笔记、书签、设置</li>
<li>备份文件格式为 JSON，方便查看和迁移</li>
</ul>

<h3>导入恢复</h3>
<ul>
<li>选择之前导出的 JSON 备份文件</li>
<li>系统会完整恢复所有数据</li>
<li>迁移到新设备时非常实用</li>
</ul>

<h2>回收站机制</h2>
<ul>
<li>删除的书籍先进入回收站</li>
<li>回收站中的书籍可以恢复或永久删除</li>
<li>永久删除后数据不可恢复，请谨慎操作</li>
</ul>

<p style="margin-top:1.5em; padding:12px; background:#ffebee; border-left:4px solid #E53935; border-radius:0 8px 8px 0;">
<strong>⚠️ 重要提醒</strong>：PIN 码和安全问题的答案一旦忘记且没有备份，数据将无法解密恢复。请务必妥善保管 PIN 码，并定期导出备份。
</p>`
    },
    {
      title: '第六章：快捷键与命令面板',
      content: `<h1>快捷键与命令面板</h1>

<h2>命令面板</h2>
<p>命令面板是 X-ReaderPlus 的快速操作中心。按 <kbd>Ctrl+K</kbd> 打开，输入关键词即可搜索并执行各种操作：</p>
<ul>
<li>快速导航到任意页面（书架、笔记、设置、统计等）</li>
<li>切换主题、新建书库等快捷操作</li>
<li>自动过滤匹配的命令，回车执行</li>
</ul>

<h2>完整快捷键列表</h2>

<h3>全局快捷键</h3>
<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse;">
<tr style="background:#f0f0f0;"><th>快捷键</th><th>功能</th></tr>
<tr><td><kbd>Ctrl + K</kbd></td><td>打开/关闭命令面板</td></tr>
<tr><td><kbd>Ctrl + T</kbd></td><td>切换主题（明亮 → 暗黑 → 护眼）</td></tr>
<tr><td><kbd>Ctrl + B</kbd></td><td>老板键 — 最小化到托盘/快速隐藏</td></tr>
</table>

<h3>阅读器快捷键</h3>
<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse;">
<tr style="background:#f0f0f0;"><th>快捷键</th><th>功能</th></tr>
<tr><td><kbd>←</kbd></td><td>上一章</td></tr>
<tr><td><kbd>→</kbd></td><td>下一章</td></tr>
<tr><td><kbd>↑</kbd></td><td>向上滚动一行</td></tr>
<tr><td><kbd>↓</kbd></td><td>向下滚动一行</td></tr>
<tr><td><kbd>PageUp</kbd></td><td>向上翻页</td></tr>
<tr><td><kbd>PageDown</kbd> / <kbd>Space</kbd></td><td>向下翻页</td></tr>
<tr><td><kbd>Home</kbd></td><td>跳转到章节开头</td></tr>
<tr><td><kbd>End</kbd></td><td>跳转到章节末尾</td></tr>
<tr><td><kbd>Ctrl + F</kbd></td><td>搜索当前章节</td></tr>
<tr><td><kbd>Ctrl + D</kbd></td><td>添加/删除书签</td></tr>
<tr><td><kbd>Ctrl + 滚轮</kbd></td><td>缩放字号</td></tr>
<tr><td><kbd>Esc</kbd></td><td>退出阅读模式</td></tr>
</table>

<h2>自定义快捷键 (Electron)</h2>
<p>在 Electron 环境下，您可以在"设置 → 快捷键"中自定义以下快捷键：</p>
<ul>
<li><strong>老板键</strong>：默认 Ctrl+B</li>
<li><strong>切换主题</strong>：默认 Ctrl+T</li>
<li><strong>命令面板</strong>：默认 Ctrl+K</li>
</ul>
<p>修改后立即生效，无需重启。请注意避免与系统快捷键冲突。</p>

<h2>手势操作（触控设备）</h2>
<ul>
<li><strong>左右滑动</strong>：切换章节</li>
<li><strong>上下滑动</strong>：滚动内容</li>
<li><strong>双指缩放</strong>：调整字号</li>
</ul>

<p style="margin-top:1.5em; padding:12px; background:#e3f2fd; border-left:4px solid #1E88E5; border-radius:0 8px 8px 0;">
<strong>⌨️ 效率提示</strong>：熟练使用快捷键可以大幅提升阅读效率。建议重点记住 <kbd>Ctrl+K</kbd>（命令面板），通过它您可以快速访问任何功能而无需记住所有快捷键。
</p>`
    },
    {
      title: '第七章：统计、词典与其他工具',
      content: `<h1>统计、词典与其他工具</h1>

<h2>阅读统计</h2>
<p>在"统计"页面，您可以查看全面的阅读数据分析：</p>

<h3>统计维度</h3>
<ul>
<li><strong>阅读时长</strong>：总阅读时间（精确到分钟），按日/周/月统计</li>
<li><strong>阅读书籍数</strong>：已读、在读、未读数量分布</li>
<li><strong>阅读速度</strong>：平均阅读速度（字数/分钟）</li>
<li><strong>活跃天数</strong>：有阅读记录的天数统计</li>
<li><strong>阅读日历</strong>：日历热力图，直观展示每日阅读情况</li>
<li><strong>标签统计</strong>：按标签分类的阅读统计</li>
</ul>

<h3>统计用途</h3>
<ul>
<li>追踪阅读习惯，设定阅读目标</li>
<li>了解阅读偏好（哪类书读得多）</li>
<li>发现阅读高峰时段，合理安排阅读时间</li>
</ul>

<h2>内置词典</h2>
<p>"词典"页面提供基础的词语查询功能：</p>
<ul>
<li><strong>词语搜索</strong>：输入中文词语，查看释义</li>
<li><strong>内置词库</strong>：包含常用词汇的解释</li>
<li><strong>标注关联</strong>：查看包含该词语的标注记录</li>
</ul>

<h2>标签管理</h2>
<p>"标签"页面集中管理所有标签：</p>
<ul>
<li>查看所有已使用的标签</li>
<li>点击标签查看包含该标签的书籍列表</li>
<li>重命名或删除标签</li>
<li>标签云视图，直观展示标签分布</li>
</ul>

<h2>阅读历史</h2>
<p>"历史"页面记录您的阅读足迹：</p>
<ul>
<li><strong>时间线视图</strong>：按时间顺序展示最近阅读的书籍</li>
<li><strong>快速继续阅读</strong>：点击任意历史记录直接进入对应书籍</li>
<li><strong>阅读时段统计</strong>：每天每个时段阅读了哪些书</li>
</ul>

<h2>回收站</h2>
<p>删除的书籍先进入回收站，提供安全缓冲：</p>
<ul>
<li>查看已删除的书籍列表</li>
<li><strong>恢复</strong>：将书籍恢复到原书库</li>
<li><strong>永久删除</strong>：彻底清除（不可恢复，请谨慎操作）</li>
<li><strong>清空回收站</strong>：一键清除所有已删除书籍</li>
</ul>

<h2>主题与个性化</h2>
<p>在"设置 → 个性化"中，您可以深度定制界面外观：</p>
<ul>
<li><strong>主题配色</strong>：自定义主色、辅色、强调色（支持颜色选择器）</li>
<li><strong>阅读区配色</strong>：独立设置阅读区的背景色和文字颜色</li>
<li><strong>背景图片</strong>：为阅读区设置背景图片 URL</li>
<li><strong>背景不透明度</strong>：调节背景图片/颜色的透明度</li>
</ul>

<h2>数据管理</h2>
<ul>
<li><strong>导出备份</strong>：将所有数据导出为 JSON 文件</li>
<li><strong>导入恢复</strong>：从备份文件恢复数据</li>
<li><strong>刷新元数据</strong>：重新计算所有书籍的字数等元数据</li>
<li><strong>清除全部数据</strong>：重置应用（需确认操作）</li>
</ul>

<p style="margin-top:1.5em; padding:12px; background:#e8f5e9; border-left:4px solid #43A047; border-radius:0 8px 8px 0;">
<strong>🎉 恭喜</strong>：您已经完成了 X-ReaderPlus 使用指南的全部章节！现在您可以充分利用这些功能，享受高效、安全的阅读体验。如有问题或建议，欢迎在 GitHub 上反馈。
</p>

<h2>附录：常见问题</h2>
<ul>
<li><strong>Q: 如何添加新书籍？</strong> A: 在书架页面拖入文件或点击"+"按钮。</li>
<li><strong>Q: 阅读进度会自动保存吗？</strong> A: 是的，每 5-60 秒自动保存（可在设置中调整间隔）。</li>
<li><strong>Q: 支持云端同步吗？</strong> A: X-ReaderPlus 是完全离线的本地阅读器，不提供云同步。您可以使用"导出/导入备份"功能手动迁移数据。</li>
<li><strong>Q: 如何切换章节？</strong> A: 使用 ← → 方向键、点击目录面板、或使用阅读器底部的章节导航按钮。</li>
<li><strong>Q: 忘记 PIN 码怎么办？</strong> A: 如果设置了安全问题，可以通过回答安全问题重置。否则，需要清除应用数据重新开始。</li>
</ul>`
    }
  ]
}

export { SAMPLE_BOOK_ID }
