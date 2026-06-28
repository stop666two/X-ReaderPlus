package api

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"x-reader-plus/backend/db"
)

func Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/books/count", handleBooksCount)
	mux.HandleFunc("/api/books/", handleBookByID)
	mux.HandleFunc("/api/books", handleBooks)
	mux.HandleFunc("/api/chapters/", handleChapters)
	mux.HandleFunc("/api/config", handleConfigRoot)
	mux.HandleFunc("/api/config/", handleConfig)
	mux.HandleFunc("/api/bookmarks/", handleBookmarkByID)
	mux.HandleFunc("/api/bookmarks", handleBookmarks)
	mux.HandleFunc("/api/annotations/", handleAnnotationByID)
	mux.HandleFunc("/api/annotations", handleAnnotations)
	mux.HandleFunc("/api/trash/", handleTrashByID)
	mux.HandleFunc("/api/trash", handleTrash)
	mux.HandleFunc("/api/libraries/", handleLibraryByID)
	mux.HandleFunc("/api/libraries", handleLibraries)
	mux.HandleFunc("/api/theme", handleTheme)
	mux.HandleFunc("/api/settings", handleSettings)
	mux.HandleFunc("/api/history", handleHistory)
	mux.HandleFunc("/api/stats", handleStats)
	mux.HandleFunc("/api/stats/upsert", handleStatsUpsert)
	mux.HandleFunc("/api/search", handleSearch)
	mux.HandleFunc("/api/parse", handleParse)
	mux.HandleFunc("/api/import", handleImport)
	mux.HandleFunc("/api/clear", handleClear)
	mux.HandleFunc("/api/delete-books", handleDeleteBooksBatch)
	mux.HandleFunc("/api/raw/", handleRawFile)
}

func jsonOK(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}
func jsonErr(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
func decode(r *http.Request, v any) error { return json.NewDecoder(r.Body).Decode(v) }

// ── Books ──
func handleBooks(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		page, _ := strconv.Atoi(r.URL.Query().Get("page"))
		if page < 1 { page = 1 }
		pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))
		if pageSize < 1 { pageSize = 30 }
		books, total := booksGet(page, pageSize, r.URL.Query().Get("libraryId"))
		jsonOK(w, []any{books, total})
	case "POST":
		var b Book; decode(r, &b)
		booksInsert(&b)
		jsonOK(w, b)
	}
}
func handleBooksCount(w http.ResponseWriter, r *http.Request) {
	var n int64; db.Meta.QueryRow("SELECT COUNT(*) FROM books").Scan(&n)
	jsonOK(w, n)
}
func handleBookByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/books/")
	if id == "" || id == "count" { http.NotFound(w, r); return }
	switch r.Method {
	case "GET":
		b, err := bookByID(id)
		if err != nil { jsonErr(w, err.Error(), 500); return }
		jsonOK(w, b)
	case "PUT":
		var u map[string]any; decode(r, &u)
		bookUpdate(id, u)
		jsonOK(w, map[string]string{"ok": "true"})
	case "DELETE":
		deleteBooks([]string{id})
		jsonOK(w, map[string]string{"ok": "true"})
	}
}

func handleDeleteBooksBatch(w http.ResponseWriter, r *http.Request) {
	var body struct{ Ids []string `json:"ids"` }
	decode(r, &body)
	var wg sync.WaitGroup
	for _, id := range body.Ids {
		wg.Add(1)
		go func(bid string) { defer wg.Done(); deleteBooks([]string{bid}) }(id)
	}
	wg.Wait()
	jsonOK(w, map[string]int{"deleted": len(body.Ids)})
}

func handleClear(w http.ResponseWriter, r *http.Request) {
	var wg sync.WaitGroup
	wg.Add(3)
	go func() { defer wg.Done(); db.Meta.Exec("DELETE FROM books"); db.Meta.Exec("DELETE FROM bookmarks"); db.Meta.Exec("DELETE FROM annotations"); db.Meta.Exec("DELETE FROM trash"); db.Meta.Exec("DELETE FROM reading_history"); db.Meta.Exec("DELETE FROM reading_stats") }()
	go func() { defer wg.Done(); db.Content.Exec("DELETE FROM chapters") }()
	go func() { defer wg.Done(); db.Settings.Exec("DELETE FROM config") }()
	wg.Wait()
	jsonOK(w, map[string]string{"ok": "true"})
}

// ── Chapters (Content DB) ──
func handleChapters(w http.ResponseWriter, r *http.Request) {
	bookID := strings.TrimPrefix(r.URL.Path, "/api/chapters/")
	if bookID == "" { jsonErr(w, "missing bookId", 400); return }
	switch r.Method {
	case "GET":
		var data sql.NullString
		db.Content.QueryRow("SELECT data FROM chapters WHERE book_id = ?", bookID).Scan(&data)
		if data.Valid { w.Header().Set("Content-Type", "application/json"); w.Write([]byte(data.String)) } else { jsonOK(w, nil) }
	case "POST":
		var body struct{ Chapters json.RawMessage `json:"chapters"` }; decode(r, &body)
		db.Content.Exec("INSERT OR REPLACE INTO chapters (book_id, data) VALUES (?, ?)", bookID, string(body.Chapters))
		jsonOK(w, map[string]string{"ok": "true"})
	case "DELETE":
		db.Content.Exec("DELETE FROM chapters WHERE book_id = ?", bookID)
		jsonOK(w, map[string]string{"ok": "true"})
	}
}

// ── Config (Settings DB) ──
func handleConfigRoot(w http.ResponseWriter, r *http.Request) {
	if r.Method == "POST" {
		var body struct{ Key string `json:"key"`; Value string `json:"value"` }
		decode(r, &body)
		if body.Key == "" { jsonErr(w, "missing key", 400); return }
		db.Settings.Exec("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)", body.Key, body.Value)
		jsonOK(w, map[string]string{"ok": "true"})
		return
	}
	jsonErr(w, "method not allowed", 405)
}
func handleConfig(w http.ResponseWriter, r *http.Request) {
	key := strings.TrimPrefix(r.URL.Path, "/api/config/")
	if key == "" { jsonErr(w, "missing key", 400); return }
	switch r.Method {
	case "GET":
		var val sql.NullString
		db.Settings.QueryRow("SELECT value FROM config WHERE key = ?", key).Scan(&val)
		if val.Valid {
			raw := val.String
			if len(raw) > 0 && (raw[0] == '{' || raw[0] == '[' || raw[0] == '"') {
				w.Header().Set("Content-Type", "application/json"); w.Write([]byte(raw))
			} else { jsonOK(w, raw) }
		} else { jsonOK(w, nil) }
	case "DELETE":
		db.Settings.Exec("DELETE FROM config WHERE key = ?", key)
		jsonOK(w, map[string]string{"ok": "true"})
	}
}

// ── Bookmarks / Annotations / Trash / Libraries (Meta DB) ──
func handleBookmarks(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		rows, _ := db.Meta.Query("SELECT id, data FROM bookmarks"); defer rows.Close()
		var items []map[string]any
		for rows.Next() { var id, data string; rows.Scan(&id, &data); items = append(items, map[string]any{"id": id, "data": json.RawMessage(data)}) }
		if items == nil { items = []map[string]any{} }
		jsonOK(w, items)
	case "POST":
		var body struct{ Bookmark json.RawMessage `json:"bookmark"` }; decode(r, &body)
		var m map[string]any; json.Unmarshal(body.Bookmark, &m)
		db.Meta.Exec("INSERT OR REPLACE INTO bookmarks (id, data) VALUES (?, ?)", fmt.Sprint(m["id"]), string(body.Bookmark))
		jsonOK(w, map[string]string{"ok": "true"})
	}
}
func handleBookmarkByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/bookmarks/")
	if r.Method == "DELETE" && id != "" { db.Meta.Exec("DELETE FROM bookmarks WHERE id = ?", id) }
	jsonOK(w, map[string]string{"ok": "true"})
}

func handleAnnotations(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		rows, _ := db.Meta.Query("SELECT id, data FROM annotations"); defer rows.Close()
		var items []map[string]any
		for rows.Next() { var id, data string; rows.Scan(&id, &data); items = append(items, map[string]any{"id": id, "data": json.RawMessage(data)}) }
		if items == nil { items = []map[string]any{} }
		jsonOK(w, items)
	case "POST":
		var body struct{ Annotation json.RawMessage `json:"annotation"` }; decode(r, &body)
		var m map[string]any; json.Unmarshal(body.Annotation, &m)
		db.Meta.Exec("INSERT OR REPLACE INTO annotations (id, data) VALUES (?, ?)", fmt.Sprint(m["id"]), string(body.Annotation))
		jsonOK(w, map[string]string{"ok": "true"})
	}
}
func handleAnnotationByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/annotations/")
	switch r.Method {
	case "PUT":
		var body struct{ Annotation json.RawMessage `json:"annotation"` }; decode(r, &body)
		db.Meta.Exec("UPDATE annotations SET data = ? WHERE id = ?", string(body.Annotation), id)
		jsonOK(w, map[string]string{"ok": "true"})
	case "DELETE":
		db.Meta.Exec("DELETE FROM annotations WHERE id = ?", id)
		jsonOK(w, map[string]string{"ok": "true"})
	}
}

func handleTrash(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		rows, _ := db.Meta.Query("SELECT id, data FROM trash"); defer rows.Close()
		var items []map[string]any
		for rows.Next() { var id, data string; rows.Scan(&id, &data); items = append(items, map[string]any{"id": id, "data": json.RawMessage(data)}) }
		if items == nil { items = []map[string]any{} }
		jsonOK(w, items)
	case "POST":
		var body struct{ Item json.RawMessage `json:"item"` }; decode(r, &body)
		var m map[string]any; json.Unmarshal(body.Item, &m)
		db.Meta.Exec("INSERT OR REPLACE INTO trash (id, data) VALUES (?, ?)", fmt.Sprint(m["id"]), string(body.Item))
		jsonOK(w, map[string]string{"ok": "true"})
	case "DELETE":
		db.Meta.Exec("DELETE FROM trash")
		jsonOK(w, map[string]string{"ok": "true"})
	}
}
func handleTrashByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/trash/")
	if r.Method == "DELETE" && id != "" { db.Meta.Exec("DELETE FROM trash WHERE id = ?", id) }
	jsonOK(w, map[string]string{"ok": "true"})
}

func handleLibraries(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		rows, _ := db.Meta.Query("SELECT id, data FROM libraries"); defer rows.Close()
		var items []map[string]any
		for rows.Next() { var id, data string; rows.Scan(&id, &data); items = append(items, map[string]any{"id": id, "data": json.RawMessage(data)}) }
		if items == nil { items = []map[string]any{} }
		jsonOK(w, items)
	case "POST":
		var body struct{ Library json.RawMessage `json:"library"` }; decode(r, &body)
		var m map[string]any; json.Unmarshal(body.Library, &m)
		db.Meta.Exec("INSERT OR REPLACE INTO libraries (id, data) VALUES (?, ?)", fmt.Sprint(m["id"]), string(body.Library))
		jsonOK(w, map[string]string{"ok": "true"})
	}
}
func handleLibraryByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/libraries/")
	if r.Method == "DELETE" && id != "" { db.Meta.Exec("DELETE FROM libraries WHERE id = ?", id) }
	jsonOK(w, map[string]string{"ok": "true"})
}

// ── History (Meta DB) ──
func handleHistory(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		rows, _ := db.Meta.Query("SELECT book_id, data, read_at FROM reading_history ORDER BY read_at DESC LIMIT 500")
		defer rows.Close()
		var items []map[string]any
		for rows.Next() {
			var bid, data string; var readAt int64
			rows.Scan(&bid, &data, &readAt)
			items = append(items, map[string]any{"bookId": bid, "data": json.RawMessage(data), "readAt": readAt})
		}
		if items == nil { items = []map[string]any{} }
		jsonOK(w, items)
	case "POST":
		var body struct{ BookId string `json:"bookId"`; Data string `json:"data"` }; decode(r, &body)
		db.Meta.Exec("DELETE FROM reading_history WHERE book_id = ?", body.BookId)
		db.Meta.Exec("INSERT INTO reading_history (book_id, data, read_at) VALUES (?, ?, ?)", body.BookId, body.Data, time.Now().UnixMilli())
		db.Meta.Exec("DELETE FROM reading_history WHERE book_id NOT IN (SELECT book_id FROM reading_history ORDER BY read_at DESC LIMIT 500)")
		jsonOK(w, map[string]string{"ok": "true"})
	case "DELETE":
		ids := r.URL.Query().Get("ids")
		if ids != "" {
			for _, id := range strings.Split(ids, ",") {
				db.Meta.Exec("DELETE FROM reading_history WHERE book_id = ?", strings.TrimSpace(id))
			}
		} else {
			db.Meta.Exec("DELETE FROM reading_history")
		}
		jsonOK(w, map[string]string{"ok": "true"})
	}
}

// ── Stats (Meta DB) ──
func handleStats(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		rows, _ := db.Meta.Query("SELECT date, data FROM reading_stats ORDER BY date DESC LIMIT 365")
		defer rows.Close()
		var items []map[string]any
		for rows.Next() { var date, data string; rows.Scan(&date, &data); items = append(items, map[string]any{"date": date, "data": json.RawMessage(data)}) }
		if items == nil { items = []map[string]any{} }
		jsonOK(w, items)
	case "POST":
		var body struct{ Date string `json:"date"`; Data string `json:"data"` }; decode(r, &body)
		db.Meta.Exec("INSERT OR REPLACE INTO reading_stats (date, data) VALUES (?, ?)", body.Date, body.Data)
		jsonOK(w, map[string]string{"ok": "true"})
	case "DELETE":
		dates := r.URL.Query().Get("dates")
		if dates != "" {
			for _, d := range strings.Split(dates, ",") {
				db.Meta.Exec("DELETE FROM reading_stats WHERE date = ?", strings.TrimSpace(d))
			}
		} else {
			db.Meta.Exec("DELETE FROM reading_stats")
		}
		jsonOK(w, map[string]string{"ok": "true"})
	}
}

func handleStatsUpsert(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		jsonErr(w, "method not allowed", 405)
		return
	}
	var body struct {
		Date         string `json:"date"`
		BooksOpened  int    `json:"booksOpened"`
		MinutesRead  int    `json:"minutesRead"`
		PagesRead    int    `json:"pagesRead"`
	}
	decode(r, &body)
	if body.Date == "" {
		jsonErr(w, "missing date", 400)
		return
	}
	db.Meta.Exec(`INSERT INTO reading_stats (date, data) VALUES (?, '{"date":"","minutesRead":0,"booksOpened":0,"pagesRead":0}') ON CONFLICT(date) DO NOTHING`, body.Date)
	var existing string
	db.Meta.QueryRow("SELECT data FROM reading_stats WHERE date = ?", body.Date).Scan(&existing)
	var s struct {
		MinutesRead int `json:"minutesRead"`
		BooksOpened int `json:"booksOpened"`
		PagesRead   int `json:"pagesRead"`
	}
	if existing != "" {
		json.Unmarshal([]byte(existing), &s)
	}
	s.BooksOpened += body.BooksOpened
	s.MinutesRead += body.MinutesRead
	s.PagesRead += body.PagesRead
	updated, _ := json.Marshal(s)
	db.Meta.Exec("INSERT OR REPLACE INTO reading_stats (date, data) VALUES (?, ?)", body.Date, string(updated))
	jsonOK(w, map[string]string{"ok": "true"})
}

// ── Theme / Settings (Settings DB) ──
func handleTheme(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		var v sql.NullString
		db.Settings.QueryRow("SELECT value FROM config WHERE key = 'theme_mode'").Scan(&v)
		if v.Valid { jsonOK(w, json.RawMessage(v.String)) } else { jsonOK(w, "light") }
	case "POST":
		var body struct{ Value string `json:"value"` }; decode(r, &body)
		db.Settings.Exec("INSERT OR REPLACE INTO config (key, value) VALUES ('theme_mode', ?)", body.Value)
		jsonOK(w, map[string]string{"ok": "true"})
	}
}
func handleSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		var v sql.NullString
		db.Settings.QueryRow("SELECT value FROM config WHERE key = 'app_settings'").Scan(&v)
		if v.Valid { jsonOK(w, json.RawMessage(v.String)) } else {
			jsonOK(w, json.RawMessage(`{"readingSettings":{"fontSize":16},"toolbarAutoHideDelay":3000,"autoScrollSpeed":50}`))
		}
	case "POST":
		var body struct{ Settings json.RawMessage `json:"settings"` }; decode(r, &body)
		db.Settings.Exec("INSERT OR REPLACE INTO config (key, value) VALUES ('app_settings', ?)", string(body.Settings))
		jsonOK(w, map[string]string{"ok": "true"})
	}
}

// ── Search (Meta DB) ──
func handleSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" { jsonOK(w, []any{}); return }
	rows, _ := db.Meta.Query("SELECT id, title FROM books WHERE lower(title) LIKE ? OR lower(author) LIKE ?", "%"+strings.ToLower(q)+"%", "%"+strings.ToLower(q)+"%")
	defer rows.Close()
	type R struct{ BookID string `json:"bookId"`; BookTitle string `json:"bookTitle"`; MatchText string `json:"matchText"` }
	var results []R
	for rows.Next() { var id, title string; rows.Scan(&id, &title); results = append(results, R{BookID: id, BookTitle: title, MatchText: title}) }
	if results == nil { results = []R{} }
	jsonOK(w, results)
}

// ── Parse / Import (stub, real parsing in frontend) ──
func handleParse(w http.ResponseWriter, r *http.Request) {
	var body struct{ FilePath string `json:"filePath"` }; decode(r, &body)
	ext := fileExt(body.FilePath)
	jsonOK(w, map[string]any{"metadata": map[string]string{"title": fileTitle(body.FilePath), "author": "Unknown", "format": ext}, "chapters": []map[string]string{}})
}
func handleImport(w http.ResponseWriter, r *http.Request) {
	var body struct{ FilePath string `json:"filePath"` }; decode(r, &body)
	b := Book{ID: newID(), Title: fileTitle(body.FilePath), Author: "Unknown", Path: body.FilePath, Format: fileExt(body.FilePath), AddedAt: time.Now().UnixMilli(), Tags: []string{}, LibraryID: "default"}
	booksInsert(&b)
	jsonOK(w, b)
}

func handleRawFile(w http.ResponseWriter, r *http.Request) {
	bookID := strings.TrimPrefix(r.URL.Path, "/api/raw/")
	if bookID == "" { jsonErr(w, "missing id", 400); return }
	switch r.Method {
	case "GET":
		var filename string
		var data []byte
		var size int64
		err := db.Content.QueryRow("SELECT filename, data, size FROM raw_files WHERE book_id = ?", bookID).Scan(&filename, &data, &size)
		if err != nil { jsonErr(w, "not found", 404); return }
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
		w.Header().Set("Content-Length", strconv.FormatInt(size, 10))
		w.Write(data)
	case "POST":
		var body struct {
			Filename string `json:"filename"`
			Data     string `json:"data"` // base64 encoded
		}
		decode(r, &body)
		raw, err := base64.StdEncoding.DecodeString(body.Data)
		if err != nil { jsonErr(w, "invalid base64", 400); return }
		db.Content.Exec("INSERT OR REPLACE INTO raw_files (book_id, filename, data, size) VALUES (?, ?, ?, ?)", bookID, body.Filename, raw, len(raw))
		jsonOK(w, map[string]string{"ok": "true"})
	case "DELETE":
		db.Content.Exec("DELETE FROM raw_files WHERE book_id = ?", bookID)
		jsonOK(w, map[string]string{"ok": "true"})
	}
}

// ── Book DB helpers (Meta) ──
type Book struct {
	ID               string   `json:"id"`
	Title            string   `json:"title"`
	Author           string   `json:"author"`
	Cover            string   `json:"cover"`
	Path             string   `json:"path"`
	Format           string   `json:"format"`
	Size             int64    `json:"size"`
	AddedAt          int64    `json:"addedAt"`
	LastReadAt       int64    `json:"lastReadAt"`
	Progress         float64  `json:"progress"`
	ChapterIndex     int      `json:"chapterIndex"`
	ChapterProgress  float64  `json:"chapterProgress"`
	Tags             []string `json:"tags"`
	Rating           int      `json:"rating"`
	Review           string   `json:"review"`
	WordCount        int64    `json:"wordCount"`
	ChapterCount     int      `json:"chapterCount"`
	TotalReadingTime int64    `json:"totalReadingTime"`
	LibraryID        string   `json:"libraryId"`
	ContentHash      string   `json:"contentHash"`
}

func booksGet(page, pageSize int, libID string) ([]Book, int64) {
	args := []any{}
	where := ""
	if libID != "" { where = " WHERE library_id = ?"; args = append(args, libID) }
	var total int64
	db.Meta.QueryRow("SELECT COUNT(*) FROM books"+where, args...).Scan(&total)
	args = append(args, pageSize, (page-1)*pageSize)
	rows, _ := db.Meta.Query("SELECT id,title,author,cover,path,format,size,added_at,last_read_at,progress,chapter_index,chapter_progress,tags,rating,review,word_count,chapter_count,total_reading_time,library_id,content_hash FROM books"+where+" ORDER BY added_at DESC LIMIT ? OFFSET ?", args...)
	defer rows.Close()
	var books []Book
	for rows.Next() {
		b := Book{}; var tagsStr string
		rows.Scan(&b.ID, &b.Title, &b.Author, &b.Cover, &b.Path, &b.Format, &b.Size, &b.AddedAt, &b.LastReadAt, &b.Progress, &b.ChapterIndex, &b.ChapterProgress, &tagsStr, &b.Rating, &b.Review, &b.WordCount, &b.ChapterCount, &b.TotalReadingTime, &b.LibraryID, &b.ContentHash)
		json.Unmarshal([]byte(tagsStr), &b.Tags)
		if b.Tags == nil { b.Tags = []string{} }
		books = append(books, b)
	}
	if books == nil { books = []Book{} }
	return books, total
}
func bookByID(id string) (*Book, error) {
	b := &Book{}; var tagsStr string
	err := db.Meta.QueryRow("SELECT id,title,author,cover,path,format,size,added_at,last_read_at,progress,chapter_index,chapter_progress,tags,rating,review,word_count,chapter_count,total_reading_time,library_id,content_hash FROM books WHERE id = ?", id).Scan(&b.ID, &b.Title, &b.Author, &b.Cover, &b.Path, &b.Format, &b.Size, &b.AddedAt, &b.LastReadAt, &b.Progress, &b.ChapterIndex, &b.ChapterProgress, &tagsStr, &b.Rating, &b.Review, &b.WordCount, &b.ChapterCount, &b.TotalReadingTime, &b.LibraryID, &b.ContentHash)
	if err != nil { return nil, err }
	json.Unmarshal([]byte(tagsStr), &b.Tags)
	if b.Tags == nil { b.Tags = []string{} }
	return b, nil
}
func booksInsert(b *Book) {
	tagsJSON, _ := json.Marshal(b.Tags)
	db.Meta.Exec(`INSERT OR REPLACE INTO books (id,title,author,cover,path,format,size,added_at,last_read_at,progress,chapter_index,chapter_progress,tags,rating,review,word_count,chapter_count,total_reading_time,library_id,content_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, b.ID, b.Title, b.Author, b.Cover, b.Path, b.Format, b.Size, b.AddedAt, b.LastReadAt, b.Progress, b.ChapterIndex, b.ChapterProgress, string(tagsJSON), b.Rating, b.Review, b.WordCount, b.ChapterCount, b.TotalReadingTime, b.LibraryID, b.ContentHash)
}
var allowedBookColumns = map[string]bool{
	"title": true, "author": true, "cover": true, "path": true, "format": true,
	"size": true, "added_at": true, "last_read_at": true, "progress": true,
	"chapter_index": true, "chapter_progress": true, "tags": true, "rating": true,
	"review": true, "word_count": true, "chapter_count": true,
	"total_reading_time": true, "library_id": true, "content_hash": true,
}

func bookUpdate(id string, u map[string]any) {
	for k, v := range u {
		dbKey := toSnake(k)
		if !allowedBookColumns[dbKey] {
			continue
		}
		if dbKey == "tags" {
			if arr, ok := v.([]any); ok {
				b, _ := json.Marshal(arr)
				v = string(b)
			}
		}
		db.Meta.Exec("UPDATE books SET "+dbKey+" = ? WHERE id = ?", v, id)
	}
}
func deleteBooks(ids []string) {
	for _, id := range ids {
		go db.Content.Exec("DELETE FROM chapters WHERE book_id = ?", id)
		db.Meta.Exec("DELETE FROM books WHERE id = ?", id)
		db.Meta.Exec("DELETE FROM bookmarks WHERE json_extract(data, '$.bookId') = ?", id)
		db.Meta.Exec("DELETE FROM annotations WHERE json_extract(data, '$.bookId') = ?", id)
		db.Meta.Exec("DELETE FROM reading_history WHERE book_id = ?", id)
	}
}

// ── Utils ──
func toSnake(s string) string {
	var b strings.Builder
	for i, c := range s {
		if c >= 'A' && c <= 'Z' { if i > 0 { b.WriteByte('_') }; b.WriteByte(byte(c) + 32) } else { b.WriteByte(byte(c)) }
	}
	return b.String()
}
func newID() string { b := make([]byte, 8); rand.Read(b); return hex.EncodeToString(b) }
func fileTitle(p string) string {
	s := p
	if i := strings.LastIndex(s, "\\"); i >= 0 { s = s[i+1:] }
	if i := strings.LastIndex(s, "/"); i >= 0 { s = s[i+1:] }
	if i := strings.LastIndex(s, "."); i >= 0 { s = s[:i] }
	return s
}
func fileExt(p string) string {
	if i := strings.LastIndex(p, "."); i >= 0 { return strings.ToLower(p[i+1:]) }
	return ""
}
func init() { log.SetFlags(log.LstdFlags) }
