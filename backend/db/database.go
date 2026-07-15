package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

var (
	// Global DB handles. WAL mode + SetMaxOpenConns(1) ensures serialized access.
	// No sync.Mutex needed — SQLite serializes internally.
	Settings *sql.DB // config, theme, PIN, shortcuts, customFonts
	Content  *sql.DB // chapters, raw_files, search_index
	Meta     *sql.DB // books, bookmarks, annotations, trash, libraries, history, stats
)

func dataDir() string {
	// Store data next to the executable (portable-friendly)
	// Use the exe path from the actual running binary, not from the build process
	exe, err := os.Executable()
	if err == nil {
		exePath := filepath.Dir(exe)
		// During wails build bindings generation, os.Executable may return a temp path.
		// Only use the exe directory if it looks like a real installation path.
		if !strings.Contains(exePath, os.TempDir()) && !strings.Contains(exePath, "go-build") {
			dir := filepath.Join(exePath, "data")
			os.MkdirAll(dir, 0700)
			return dir
		}
	}
	// Fallback: next to the binary in the dist directory (for development)
	if cwd, err := os.Getwd(); err == nil {
		if _, err := os.Stat(filepath.Join(cwd, "dist")); err == nil {
			dir := filepath.Join(cwd, "dist", "data")
			os.MkdirAll(dir, 0700)
			return dir
		}
	}
	// Last resort: next to current working directory
	if cwd, err := os.Getwd(); err == nil {
		dir := filepath.Join(cwd, "data")
		os.MkdirAll(dir, 0700)
		return dir
	}
	// Absolute fallback: use temp directory (never APPDATA)
	dir := filepath.Join(os.TempDir(), "x-reader-plus", "data")
	os.MkdirAll(dir, 0700)
	return dir
}

func openDB(name string) (*sql.DB, error) {
	path := filepath.Join(dataDir(), name)
	log.Printf("Opening %s", path)
	conn, err := sql.Open("sqlite", path+"?_journal_mode=WAL&_synchronous=NORMAL&_busy_timeout=5000")
	if err != nil {
		return nil, err
	}
	conn.SetMaxOpenConns(1)
	return conn, nil
}

type migrationFunc func(*sql.DB) error

var schemaMigrations = map[int]migrationFunc{
	1: migrateV1toV2,
}

const SCHEMA_VERSION = 2

func getCurrentSchemaVersion() int {
	var curVer int
	err := Meta.QueryRow("SELECT COALESCE(MAX(version), 0) FROM schema_version").Scan(&curVer)
	if err != nil {
		log.Printf("schema_version query (normal on fresh DB): %v", err)
		return 0
	}
	return curVer
}

func Init() error {
	var err error
	Settings, err = openDB("settings.db")
	if err != nil {
		return err
	}
	Content, err = openDB("content.db")
	if err != nil {
		return err
	}
	Meta, err = openDB("meta.db")
	if err != nil {
		return err
	}

	if err := createSchemas(); err != nil {
		return err
	}

	// Incremental migrations — never delete databases
	curVer := getCurrentSchemaVersion()
	if curVer < SCHEMA_VERSION {
		log.Printf("Schema v%d found, migrating to v%d", curVer, SCHEMA_VERSION)
		for v := curVer + 1; v <= SCHEMA_VERSION; v++ {
			if fn, ok := schemaMigrations[v]; ok {
				log.Printf("Applying migration v%d", v)
				if err := fn(Meta); err != nil {
					return fmt.Errorf("migration v%d failed: %w", v, err)
				}
				if _, err := Meta.Exec("INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, unixepoch())", v); err != nil {
					return fmt.Errorf("schema_version update failed: %w", err)
				}
			}
		}
	}

	// Ensure foreign keys are enabled
	if _, err := Meta.Exec("PRAGMA foreign_keys = ON"); err != nil {
		log.Printf("Warning: failed to enable foreign_keys: %v", err)
	}

	// Ensure schema_version record exists
	if _, err := Meta.Exec("INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (?, unixepoch())", SCHEMA_VERSION); err != nil {
		log.Printf("Warning: schema_version insert failed: %v", err)
	}

	// Verify settings DB has schema_version too
	if _, err := Settings.Exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at INTEGER)"); err != nil {
		log.Printf("Warning: settings schema_version table creation failed: %v", err)
	}
	if _, err := Content.Exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at INTEGER)"); err != nil {
		log.Printf("Warning: content schema_version table creation failed: %v", err)
	}

	// Ensure default library
	var count int
	if err := Meta.QueryRow("SELECT COUNT(*) FROM libraries").Scan(&count); err != nil {
		return err
	}
	if count == 0 {
	if _, err := Meta.Exec(`INSERT OR IGNORE INTO libraries (id, data) VALUES ('default', '{"id":"default","name":"默认书库","path":"","mode":"copy","createdAt":0,"bookCount":0}')`); err != nil {
			return err
		}
	}

	// Ensure sample book and chapters exist (always runs — INSERT OR REPLACE is safe)
	createSampleBook()

	log.Println("All databases initialized")
	return nil
}

// migrateV1toV2: Add content_hash column to books table (v1 → v2)
func migrateV1toV2(db *sql.DB) error {
	// Check if column already exists
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM pragma_table_info('books') WHERE name='content_hash'").Scan(&count)
	if err != nil {
		// pragma_table_info might not exist on older sqlite — try ALTER TABLE directly
		_, err = db.Exec("ALTER TABLE books ADD COLUMN content_hash TEXT DEFAULT ''")
		if err != nil {
			// If column already exists or table doesn't exist yet, that's OK
			log.Printf("migrateV1toV2 ALTER TABLE (optional): %v", err)
		}
		return nil
	}
	if count == 0 {
		_, err = db.Exec("ALTER TABLE books ADD COLUMN content_hash TEXT DEFAULT ''")
		if err != nil {
			log.Printf("migrateV1toV2: %v", err)
		}
	}
	return nil
}

func Close() {
	if Settings != nil { Settings.Close() }
	if Content != nil { Content.Close() }
	if Meta != nil { Meta.Close() }
}

func createSchemas() error {
	// Settings DB
	if _, err := Settings.Exec(`CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT DEFAULT '')`); err != nil { return err }
	if _, err := Settings.Exec(`CREATE TABLE IF NOT EXISTS custom_fonts (id TEXT PRIMARY KEY, family TEXT, data TEXT, format TEXT)`); err != nil { return err }

	// Content DB
	if _, err := Content.Exec(`CREATE TABLE IF NOT EXISTS chapters (book_id TEXT PRIMARY KEY, data TEXT DEFAULT '')`); err != nil { return err }
	if _, err := Content.Exec(`CREATE TABLE IF NOT EXISTS raw_files (book_id TEXT PRIMARY KEY, filename TEXT, data BLOB, size INTEGER)`); err != nil { return err }
	if _, err := Content.Exec(`CREATE TABLE IF NOT EXISTS search_index (term TEXT PRIMARY KEY, book_ids TEXT NOT NULL, updated_at INTEGER)`); err != nil { return err }

	// Meta DB
	if _, err := Meta.Exec(`CREATE TABLE IF NOT EXISTS books (
		id TEXT PRIMARY KEY, title TEXT DEFAULT '', author TEXT DEFAULT '',
		cover TEXT DEFAULT '', path TEXT DEFAULT '', format TEXT DEFAULT '',
		size INTEGER DEFAULT 0, added_at INTEGER DEFAULT 0, last_read_at INTEGER DEFAULT 0,
		progress REAL DEFAULT 0, chapter_index INTEGER DEFAULT 0, chapter_progress REAL DEFAULT 0,
		tags TEXT DEFAULT '[]', rating INTEGER DEFAULT 0, review TEXT DEFAULT '',
		word_count INTEGER DEFAULT 0, chapter_count INTEGER DEFAULT 0,
		total_reading_time INTEGER DEFAULT 0, library_id TEXT DEFAULT 'default',
		content_hash TEXT DEFAULT ''
	)`); err != nil { return err }
	if _, err := Meta.Exec(`CREATE TABLE IF NOT EXISTS bookmarks (id TEXT PRIMARY KEY, data TEXT DEFAULT '')`); err != nil { return err }
	if _, err := Meta.Exec(`CREATE TABLE IF NOT EXISTS annotations (id TEXT PRIMARY KEY, data TEXT DEFAULT '')`); err != nil { return err }
	if _, err := Meta.Exec(`CREATE TABLE IF NOT EXISTS trash (id TEXT PRIMARY KEY, data TEXT DEFAULT '')`); err != nil { return err }
	if _, err := Meta.Exec(`CREATE TABLE IF NOT EXISTS libraries (id TEXT PRIMARY KEY, data TEXT DEFAULT '')`); err != nil { return err }
	if _, err := Meta.Exec(`CREATE TABLE IF NOT EXISTS reading_history (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		book_id TEXT NOT NULL,
		data TEXT DEFAULT '',
		read_at INTEGER NOT NULL
	)`); err != nil { return err }
	if _, err := Meta.Exec(`CREATE TABLE IF NOT EXISTS reading_stats (date TEXT PRIMARY KEY, data TEXT DEFAULT '')`); err != nil { return err }
	if _, err := Meta.Exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at INTEGER)`); err != nil { return err }

	// Indexes
	if _, err := Meta.Exec(`CREATE INDEX IF NOT EXISTS idx_books_library ON books(library_id)`); err != nil { return err }
	if _, err := Meta.Exec(`CREATE INDEX IF NOT EXISTS idx_books_added ON books(added_at)`); err != nil { return err }
	if _, err := Meta.Exec(`CREATE INDEX IF NOT EXISTS idx_books_format ON books(format)`); err != nil { return err }
	if _, err := Meta.Exec(`CREATE INDEX IF NOT EXISTS idx_books_title ON books(title)`); err != nil { return err }
	if _, err := Meta.Exec(`CREATE INDEX IF NOT EXISTS idx_history_book ON reading_history(book_id)`); err != nil { return err }
	if _, err := Meta.Exec(`CREATE INDEX IF NOT EXISTS idx_history_time ON reading_history(read_at DESC)`); err != nil { return err }

	return nil
}

// RecreateDefaults recreates default library and sample book after a full data clear.
func RecreateDefaults() {
	if _, err := Meta.Exec(`INSERT OR IGNORE INTO libraries (id, data) VALUES ('default', '{"id":"default","name":"默认书库","path":"","mode":"copy","createdAt":0,"bookCount":0}')`); err != nil {
		log.Printf("Failed to recreate default library: %v", err)
	}
	createSampleBook()
}

func createSampleBook() {
	id := "sample-book-001"
	now := time.Now().UnixMilli()
	if _, err := Meta.Exec(`INSERT OR REPLACE INTO books (id, title, author, format, size, added_at, last_read_at, tags, rating, review, word_count, chapter_count, library_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'default')`,
		id, "X-ReaderPlus 使用指南", "X-ReaderPlus 团队", "md", 0, now, now, `["指南","入门"]`, 4, "一本详细的功能使用指南，帮助您快速上手 X-ReaderPlus。", 500, 7); err != nil {
		log.Printf("Failed to create sample book: %v", err)
		return
	}
	chapters := `[{"title":"第一章：欢迎使用 X-ReaderPlus","content":"<h1>欢迎使用 X-ReaderPlus</h1><p>X-ReaderPlus 是一款完全脱机的现代化多格式阅读器。无需联网，所有数据本地存储。</p><h2>支持格式</h2><ul><li>EPUB、PDF、TXT、Markdown、HTML</li><li>FB2、DJVU、DOCX/ODT/RTF</li><li>CBZ、CBT、CHM、LIT、LRF</li></ul>"},{"title":"第二章：导入书籍","content":"<h1>导入书籍</h1><p>点击顶部工具栏的导入按钮，选择文件或拖拽到书架区域即可导入。</p><p>支持单文件和批量导入。重复文件会自动检测并跳过。</p>"},{"title":"第三章：阅读界面","content":"<h1>阅读界面</h1><p>三种阅读模式：滚动阅读、翻页阅读和自动滚屏。</p><ul><li>滚动模式：自由滚动，适合快速浏览</li><li>翻页模式：左右分页，模拟纸质书体验</li><li>自动滚屏：解放双手，自动滚动</li></ul>"},{"title":"第四章：标注与笔记","content":"<h1>标注与笔记</h1><p>选中文本后可进行标注（6种颜色高亮）或添加笔记。</p><p>所有标注和笔记可在笔记页面集中管理，支持搜索和导出。</p>"},{"title":"第五章：书签与目录","content":"<h1>书签与目录</h1><p>点击右上角书签图标可添加书签。目录面板显示章节结构，点击可快速跳转。</p>"},{"title":"第六章：搜索功能","content":"<h1>搜索功能</h1><p>支持全文搜索，可在所有书籍中检索关键词。</p><p>搜索索引自动构建，支持中文分词和英文单词匹配。</p>"},{"title":"第七章：个性化设置","content":"<h1>个性化设置</h1><p>在设置页面可调整字体、字号、行距、主题颜色等。</p><p>支持自定义CSS、上传字体、设置PIN码保护隐私。</p><p>数据可通过WebDAV备份到远程服务器。</p>"}]`
	if _, err := Content.Exec(`INSERT OR REPLACE INTO chapters (book_id, data) VALUES (?, ?)`, id, chapters); err != nil {
		log.Printf("Failed to create sample chapters: %v", err)
	}
}
