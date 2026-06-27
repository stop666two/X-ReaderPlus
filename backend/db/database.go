package db

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

var (
	Settings *sql.DB // config, theme, PIN, shortcuts
	Content  *sql.DB // chapters
	Meta     *sql.DB // books, bookmarks, annotations, trash, libraries, history, stats
)

func dataDir() string {
	appdata := os.Getenv("APPDATA")
	if appdata == "" {
		appdata = filepath.Join(os.Getenv("HOME"), ".config")
	}
	dir := filepath.Join(appdata, "x-reader-plus", "X-ReaderPlus", "data")
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

	// Ensure default library
	var count int
	Meta.QueryRow("SELECT COUNT(*) FROM libraries").Scan(&count)
	if count == 0 {
		Meta.Exec(`INSERT OR IGNORE INTO libraries (id, data) VALUES ('default', '{"id":"default","name":"Default Library","path":"","mode":"copy","createdAt":0,"bookCount":0}')`)
	}

	// Ensure sample book on first run
	Meta.QueryRow("SELECT COUNT(*) FROM books").Scan(&count)
	if count == 0 {
		createSampleBook()
	}

	log.Println("All databases initialized")
	return nil
}

func Close() {
	if Settings != nil { Settings.Close() }
	if Content != nil { Content.Close() }
	if Meta != nil { Meta.Close() }
}

func createSchemas() error {
	// Settings DB
	Settings.Exec(`CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT DEFAULT '')`)

	// Content DB
	Content.Exec(`CREATE TABLE IF NOT EXISTS chapters (book_id TEXT PRIMARY KEY, data TEXT DEFAULT '')`)
	Content.Exec(`CREATE TABLE IF NOT EXISTS raw_files (book_id TEXT PRIMARY KEY, filename TEXT, data BLOB, size INTEGER)`)
	Content.Exec(`CREATE INDEX IF NOT EXISTS idx_raw_files_book ON raw_files(book_id)`)

	// Meta DB
	Meta.Exec(`CREATE TABLE IF NOT EXISTS books (
		id TEXT PRIMARY KEY, title TEXT DEFAULT '', author TEXT DEFAULT '',
		cover TEXT DEFAULT '', path TEXT DEFAULT '', format TEXT DEFAULT '',
		size INTEGER DEFAULT 0, added_at INTEGER DEFAULT 0, last_read_at INTEGER DEFAULT 0,
		progress REAL DEFAULT 0, chapter_index INTEGER DEFAULT 0, chapter_progress REAL DEFAULT 0,
		tags TEXT DEFAULT '[]', rating INTEGER DEFAULT 0, review TEXT DEFAULT '',
		word_count INTEGER DEFAULT 0, chapter_count INTEGER DEFAULT 0,
		total_reading_time INTEGER DEFAULT 0, library_id TEXT DEFAULT 'default',
		content_hash TEXT DEFAULT ''
	)`)
	Meta.Exec(`CREATE TABLE IF NOT EXISTS bookmarks (id TEXT PRIMARY KEY, data TEXT DEFAULT '')`)
	Meta.Exec(`CREATE TABLE IF NOT EXISTS annotations (id TEXT PRIMARY KEY, data TEXT DEFAULT '')`)
	Meta.Exec(`CREATE TABLE IF NOT EXISTS trash (id TEXT PRIMARY KEY, data TEXT DEFAULT '')`)
	Meta.Exec(`CREATE TABLE IF NOT EXISTS libraries (id TEXT PRIMARY KEY, data TEXT DEFAULT '')`)
	Meta.Exec(`CREATE TABLE IF NOT EXISTS reading_history (book_id TEXT, data TEXT DEFAULT '', read_at INTEGER)`)
	Meta.Exec(`CREATE TABLE IF NOT EXISTS reading_stats (date TEXT PRIMARY KEY, data TEXT DEFAULT '')`)

	Meta.Exec(`CREATE INDEX IF NOT EXISTS idx_books_library ON books(library_id)`)
	Meta.Exec(`CREATE INDEX IF NOT EXISTS idx_books_added ON books(added_at)`)
	Meta.Exec(`CREATE INDEX IF NOT EXISTS idx_history_book ON reading_history(book_id)`)

	return nil
}

func createSampleBook() {
	id := "sample-guide"
	Meta.Exec(`INSERT OR IGNORE INTO books (id, title, author, format, added_at, tags, chapter_count, library_id) VALUES (?, 'X-ReaderPlus User Guide', 'X-ReaderPlus Team', 'md', unixepoch()*1000, '["guide","help"]', 1, 'default')`, id)
	chapters := `[{"title":"Welcome","content":"<h1>Welcome to X-ReaderPlus</h1><p>A fully offline desktop multi-format e-book reader built with Go + Vue 3 + Vuetify 3.</p><h2>Getting Started</h2><ul><li>Click <b>Import</b> to add books</li><li>Supported: EPUB, PDF, TXT, MOBI, Markdown, HTML, FB2, DJVU, DOCX, CBZ</li><li>All data stored locally in SQLite</li></ul>"}]`
	Content.Exec(`INSERT OR IGNORE INTO chapters (book_id, data) VALUES (?, ?)`, id, chapters)
}
