package api

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"mime"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"x-reader-plus/backend/db"
)

func rowsScan(rows *sql.Rows, dest ...any) error {
	if err := rows.Scan(dest...); err != nil {
		log.Printf("rows.Scan error: %v", err)
		return err
	}
	return nil
}

func rowsClose(rows *sql.Rows) {
	if err := rows.Err(); err != nil {
		log.Printf("rows iteration error: %v", err)
	}
	rows.Close()
}

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
	mux.HandleFunc("/api/tags", handleTags)
	mux.HandleFunc("/api/clear", handleClear)
	mux.HandleFunc("/api/delete-books", handleDeleteBooksBatch)
	mux.HandleFunc("/api/cleanup-orphans", handleCleanupOrphans)
	mux.HandleFunc("/api/raw/", handleRawFile)
}

func jsonOK(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("jsonOK encode error: %v", err)
	}
}
func jsonErr(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
func decode(w http.ResponseWriter, r *http.Request, v any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 10<<20) // 10MB body limit
	err := json.NewDecoder(r.Body).Decode(v)
	var maxBytesErr *http.MaxBytesError
	if errors.As(err, &maxBytesErr) {
		return nil
	}
	return err
}

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
		var b Book
		if err := decode(w, r, &b); err != nil { jsonErr(w, "invalid JSON", 400); return }
		if err := booksInsert(&b); err != nil { jsonErr(w, "insert failed: "+err.Error(), 500); return }
		jsonOK(w, b)
	default:
		jsonErr(w, "method not allowed", 405)
	}
}
func handleBooksCount(w http.ResponseWriter, r *http.Request) {
	var n int64
	if err := db.Meta.QueryRow("SELECT COUNT(*) FROM books").Scan(&n); err != nil {
		jsonErr(w, "count failed: "+err.Error(), 500); return
	}
	jsonOK(w, n)
}
func handleBookByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/books/")
	if id == "" { http.NotFound(w, r); return }
	switch r.Method {
	case "GET":
		b, err := bookByID(id)
		if err != nil { jsonErr(w, err.Error(), 500); return }
		jsonOK(w, b)
	case "PUT":
		var u map[string]any
		if err := decode(w, r, &u); err != nil { jsonErr(w, "invalid JSON", 400); return }
		if err := bookUpdate(id, u); err != nil { jsonErr(w, "update failed: "+err.Error(), 500); return }
		jsonOK(w, map[string]string{"ok": "true"})
	case "DELETE":
		if err := deleteBooks([]string{id}); err != nil { jsonErr(w, "delete failed: "+err.Error(), 500); return }
		jsonOK(w, map[string]string{"ok": "true"})
	default:
		jsonErr(w, "method not allowed", 405)
	}
}

func handleDeleteBooksBatch(w http.ResponseWriter, r *http.Request) {
	var body struct{ Ids []string `json:"ids"` }
	if err := decode(w, r, &body); err != nil { jsonErr(w, "invalid JSON", 400); return }
	if err := deleteBooks(body.Ids); err != nil { jsonErr(w, "delete failed: "+err.Error(), 500); return }
	jsonOK(w, map[string]int{"deleted": len(body.Ids)})
}

func handleCleanupOrphans(w http.ResponseWriter, r *http.Request) {
	if r.Method != "DELETE" { jsonErr(w, "method not allowed", 405); return }
	// Delete all orphaned data: bookmarks, annotations, history referencing non-existent books
	delBm, err := db.Meta.Exec(`DELETE FROM bookmarks WHERE json_extract(data, '$.bookId') IS NOT NULL AND json_extract(data, '$.bookId') NOT IN (SELECT id FROM books)`)
	if err != nil { jsonErr(w, "cleanup bookmarks failed: "+err.Error(), 500); return }
	delAn, err := db.Meta.Exec(`DELETE FROM annotations WHERE json_extract(data, '$.bookId') IS NOT NULL AND json_extract(data, '$.bookId') NOT IN (SELECT id FROM books)`)
	if err != nil { jsonErr(w, "cleanup annotations failed: "+err.Error(), 500); return }
	delHx, err := db.Meta.Exec(`DELETE FROM reading_history WHERE book_id NOT IN (SELECT id FROM books)`)
	if err != nil { jsonErr(w, "cleanup history failed: "+err.Error(), 500); return }
	bmCount, _ := delBm.RowsAffected()
	anCount, _ := delAn.RowsAffected()
	hxCount, _ := delHx.RowsAffected()
	jsonOK(w, map[string]any{"bookmarks": bmCount, "annotations": anCount, "history": hxCount})
}

func handleClear(w http.ResponseWriter, r *http.Request) {
	if r.Method != "DELETE" { jsonErr(w, "method not allowed", 405); return }
	tx, err := db.Meta.Begin()
	if err != nil { jsonErr(w, "tx failed: "+err.Error(), 500); return }
	if _, err := tx.Exec("DELETE FROM books"); err != nil { tx.Rollback(); jsonErr(w, "clear books failed: "+err.Error(), 500); return }
	if _, err := tx.Exec("DELETE FROM bookmarks"); err != nil { tx.Rollback(); jsonErr(w, "clear bookmarks failed: "+err.Error(), 500); return }
	if _, err := tx.Exec("DELETE FROM annotations"); err != nil { tx.Rollback(); jsonErr(w, "clear annotations failed: "+err.Error(), 500); return }
	if _, err := tx.Exec("DELETE FROM trash"); err != nil { tx.Rollback(); jsonErr(w, "clear trash failed: "+err.Error(), 500); return }
	if _, err := tx.Exec("DELETE FROM libraries"); err != nil { tx.Rollback(); jsonErr(w, "clear libraries failed: "+err.Error(), 500); return }
	if _, err := tx.Exec("DELETE FROM reading_history"); err != nil { tx.Rollback(); jsonErr(w, "clear history failed: "+err.Error(), 500); return }
	if _, err := tx.Exec("DELETE FROM reading_stats"); err != nil { tx.Rollback(); jsonErr(w, "clear stats failed: "+err.Error(), 500); return }
	if err := tx.Commit(); err != nil { jsonErr(w, "tx commit failed: "+err.Error(), 500); return }
	if _, err := db.Content.Exec("DELETE FROM chapters"); err != nil { jsonErr(w, "clear content failed: "+err.Error(), 500); return }
	if _, err := db.Content.Exec("DELETE FROM raw_files"); err != nil { jsonErr(w, "clear raw files failed: "+err.Error(), 500); return }
	if _, err := db.Settings.Exec("DELETE FROM config"); err != nil { jsonErr(w, "clear settings failed: "+err.Error(), 500); return }
	db.RecreateDefaults()
	jsonOK(w, map[string]string{"ok": "true"})
}

// ── Chapters (Content DB) ──
func handleChapters(w http.ResponseWriter, r *http.Request) {
	bookID := strings.TrimPrefix(r.URL.Path, "/api/chapters/")
	if bookID == "" { jsonErr(w, "missing bookId", 400); return }
	switch r.Method {
	case "GET":
		var data sql.NullString
		if err := db.Content.QueryRow("SELECT data FROM chapters WHERE book_id = ?", bookID).Scan(&data); err != nil && err != sql.ErrNoRows { jsonErr(w, "query failed: "+err.Error(), 500); return }
		if data.Valid { w.Header().Set("Content-Type", "application/json"); w.Write([]byte(data.String)) } else { jsonOK(w, nil) }
	case "POST":
		var body struct{ Chapters json.RawMessage `json:"chapters"` }
		if err := decode(w, r, &body); err != nil { jsonErr(w, "invalid JSON", 400); return }
		if _, err := db.Content.Exec("INSERT OR REPLACE INTO chapters (book_id, data) VALUES (?, ?)", bookID, string(body.Chapters)); err != nil { jsonErr(w, "write failed: "+err.Error(), 500); return }
		jsonOK(w, map[string]string{"ok": "true"})
	case "DELETE":
		if _, err := db.Content.Exec("DELETE FROM chapters WHERE book_id = ?", bookID); err != nil { jsonErr(w, "delete failed: "+err.Error(), 500); return }
		jsonOK(w, map[string]string{"ok": "true"})
	default:
		jsonErr(w, "method not allowed", 405)
	}
}

// ── Config (Settings DB) ──
func handleConfigRoot(w http.ResponseWriter, r *http.Request) {
	if r.Method == "POST" {
		var body struct{ Key string `json:"key"`; Value string `json:"value"` }
		if err := decode(w, r, &body); err != nil { jsonErr(w, "invalid JSON", 400); return }
		if body.Key == "" { jsonErr(w, "missing key", 400); return }
		if _, err := db.Settings.Exec("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)", body.Key, body.Value); err != nil { jsonErr(w, "write failed: "+err.Error(), 500); return }
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
		if err := db.Settings.QueryRow("SELECT value FROM config WHERE key = ?", key).Scan(&val); err != nil && err != sql.ErrNoRows { jsonErr(w, "query failed: "+err.Error(), 500); return }
		if val.Valid {
			raw := val.String
			if len(raw) > 0 && (raw[0] == '{' || raw[0] == '[' || raw[0] == '"') {
				w.Header().Set("Content-Type", "application/json"); w.Write([]byte(raw))
			} else { jsonOK(w, raw) }
		} else { jsonOK(w, nil) }
	case "DELETE":
		if _, err := db.Settings.Exec("DELETE FROM config WHERE key = ?", key); err != nil { jsonErr(w, "delete failed: "+err.Error(), 500); return }
		jsonOK(w, map[string]string{"ok": "true"})
	default:
		jsonErr(w, "method not allowed", 405)
	}
}

// ── Bookmarks / Annotations / Trash / Libraries (Meta DB) ──
func handleBookmarks(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		rows, err := db.Meta.Query("SELECT id, data FROM bookmarks")
		if err != nil { jsonErr(w, "query failed: "+err.Error(), 500); return }
		defer rowsClose(rows)
		var items []map[string]any
		for rows.Next() { var id, data string; if rowsScan(rows, &id, &data) != nil { continue }; items = append(items, map[string]any{"id": id, "data": json.RawMessage(data)}) }
		if items == nil { items = []map[string]any{} }
		jsonOK(w, items)
	case "POST":
		var body struct{ Bookmark json.RawMessage `json:"bookmark"` }; if err := decode(w, r, &body); err != nil { jsonErr(w, "invalid JSON", 400); return }
		var m map[string]any
		if err := json.Unmarshal(body.Bookmark, &m); err != nil { jsonErr(w, "invalid bookmark JSON", 400); return }
		if _, err := db.Meta.Exec("INSERT OR REPLACE INTO bookmarks (id, data) VALUES (?, ?)", fmt.Sprint(m["id"]), string(body.Bookmark)); err != nil { jsonErr(w, "write failed: "+err.Error(), 500); return }
		jsonOK(w, map[string]string{"ok": "true"})
	default:
		jsonErr(w, "method not allowed", 405)
	}
}
func handleBookmarkByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/bookmarks/")
	if id == "" { jsonErr(w, "missing id", 400); return }
	if r.Method == "DELETE" {
		if _, err := db.Meta.Exec("DELETE FROM bookmarks WHERE id = ?", id); err != nil { jsonErr(w, "delete failed: "+err.Error(), 500); return }
		jsonOK(w, map[string]string{"ok": "true"})
		return
	}
	jsonErr(w, "method not allowed", 405)
}

func handleAnnotations(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		rows, err := db.Meta.Query("SELECT id, data FROM annotations")
		if err != nil { jsonErr(w, "query failed: "+err.Error(), 500); return }
		defer rowsClose(rows)
		var items []map[string]any
		for rows.Next() { var id, data string; if rowsScan(rows, &id, &data) != nil { continue }; items = append(items, map[string]any{"id": id, "data": json.RawMessage(data)}) }
		if items == nil { items = []map[string]any{} }
		jsonOK(w, items)
	case "POST":
		var body struct{ Annotation json.RawMessage `json:"annotation"` }; if err := decode(w, r, &body); err != nil { jsonErr(w, "invalid JSON", 400); return }
		var m map[string]any
		if err := json.Unmarshal(body.Annotation, &m); err != nil { jsonErr(w, "invalid annotation JSON", 400); return }
		if _, err := db.Meta.Exec("INSERT OR REPLACE INTO annotations (id, data) VALUES (?, ?)", fmt.Sprint(m["id"]), string(body.Annotation)); err != nil { jsonErr(w, "write failed: "+err.Error(), 500); return }
		jsonOK(w, map[string]string{"ok": "true"})
	default:
		jsonErr(w, "method not allowed", 405)
	}
}
func handleAnnotationByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/annotations/")
	if id == "" { jsonErr(w, "missing id", 400); return }
	switch r.Method {
	case "PUT":
		var body struct{ Annotation json.RawMessage `json:"annotation"` }
		if err := decode(w, r, &body); err != nil { jsonErr(w, "invalid JSON", 400); return }
		if len(body.Annotation) == 0 { jsonErr(w, "empty annotation", 400); return }
		if _, err := db.Meta.Exec("UPDATE annotations SET data = ? WHERE id = ?", string(body.Annotation), id); err != nil { jsonErr(w, "update failed: "+err.Error(), 500); return }
		jsonOK(w, map[string]string{"ok": "true"})
	case "DELETE":
		if _, err := db.Meta.Exec("DELETE FROM annotations WHERE id = ?", id); err != nil { jsonErr(w, "delete failed: "+err.Error(), 500); return }
		jsonOK(w, map[string]string{"ok": "true"})
	default:
		jsonErr(w, "method not allowed", 405)
	}
}

func handleTrash(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		rows, err := db.Meta.Query("SELECT id, data FROM trash")
		if err != nil { jsonErr(w, "query failed: "+err.Error(), 500); return }
		defer rowsClose(rows)
		var items []map[string]any
		for rows.Next() { var id, data string; if rowsScan(rows, &id, &data) != nil { continue }; items = append(items, map[string]any{"id": id, "data": json.RawMessage(data)}) }
		if items == nil { items = []map[string]any{} }
		jsonOK(w, items)
	case "POST":
		var body struct{ Item json.RawMessage `json:"item"` }; if err := decode(w, r, &body); err != nil { jsonErr(w, "invalid JSON", 400); return }
		var m map[string]any
		if err := json.Unmarshal(body.Item, &m); err != nil { jsonErr(w, "invalid trash item JSON", 400); return }
		if _, err := db.Meta.Exec("INSERT OR REPLACE INTO trash (id, data) VALUES (?, ?)", fmt.Sprint(m["id"]), string(body.Item)); err != nil { jsonErr(w, "write failed: "+err.Error(), 500); return }
		jsonOK(w, map[string]string{"ok": "true"})
	case "DELETE":
		if _, err := db.Meta.Exec("DELETE FROM trash"); err != nil { jsonErr(w, "clear failed: "+err.Error(), 500); return }
		jsonOK(w, map[string]string{"ok": "true"})
	default:
		jsonErr(w, "method not allowed", 405)
	}
}
func handleTrashByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/trash/")
	if id == "" { jsonErr(w, "missing id", 400); return }
	if r.Method == "DELETE" {
		if _, err := db.Meta.Exec("DELETE FROM trash WHERE id = ?", id); err != nil { jsonErr(w, "delete failed: "+err.Error(), 500); return }
		jsonOK(w, map[string]string{"ok": "true"})
		return
	}
	jsonErr(w, "method not allowed", 405)
}

func handleLibraries(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		rows, err := db.Meta.Query("SELECT id, data FROM libraries")
		if err != nil { jsonErr(w, "query failed: "+err.Error(), 500); return }
		defer rowsClose(rows)
		var items []map[string]any
		for rows.Next() { var id, data string; if rowsScan(rows, &id, &data) != nil { continue }; items = append(items, map[string]any{"id": id, "data": json.RawMessage(data)}) }
		if items == nil { items = []map[string]any{} }
		jsonOK(w, items)
	case "POST":
		var body struct{ Library json.RawMessage `json:"library"` }; if err := decode(w, r, &body); err != nil { jsonErr(w, "invalid JSON", 400); return }
		var m map[string]any
		if err := json.Unmarshal(body.Library, &m); err != nil { jsonErr(w, "invalid library JSON", 400); return }
		if _, err := db.Meta.Exec("INSERT OR REPLACE INTO libraries (id, data) VALUES (?, ?)", fmt.Sprint(m["id"]), string(body.Library)); err != nil { jsonErr(w, "write failed: "+err.Error(), 500); return }
		jsonOK(w, map[string]string{"ok": "true"})
	default:
		jsonErr(w, "method not allowed", 405)
	}
}
func handleLibraryByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/libraries/")
	if id == "" { jsonErr(w, "missing id", 400); return }
	if r.Method == "DELETE" {
		if _, err := db.Meta.Exec("DELETE FROM libraries WHERE id = ?", id); err != nil { jsonErr(w, "delete failed: "+err.Error(), 500); return }
		jsonOK(w, map[string]string{"ok": "true"})
		return
	}
	jsonErr(w, "method not allowed", 405)
}

// ── History (Meta DB) ──
func handleHistory(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		rows, err := db.Meta.Query("SELECT book_id, data, read_at FROM reading_history ORDER BY read_at DESC LIMIT 500")
		if err != nil { jsonErr(w, "query failed: "+err.Error(), 500); return }
		defer rowsClose(rows)
		var items []map[string]any
		for rows.Next() {
			var bid, data string; var readAt int64
			if rowsScan(rows, &bid, &data, &readAt) != nil { continue }
			items = append(items, map[string]any{"bookId": bid, "data": json.RawMessage(data), "readAt": readAt})
		}
		if items == nil { items = []map[string]any{} }
		jsonOK(w, items)
	case "POST":
		var body struct{ BookId string `json:"bookId"`; Data string `json:"data"` }; if err := decode(w, r, &body); err != nil { jsonErr(w, "invalid JSON", 400); return }
		tx, err := db.Meta.Begin()
		if err != nil { jsonErr(w, "tx begin failed: "+err.Error(), 500); return }
		if _, err := tx.Exec("DELETE FROM reading_history WHERE book_id = ?", body.BookId); err != nil { tx.Rollback(); jsonErr(w, "delete failed: "+err.Error(), 500); return }
		if _, err := tx.Exec("INSERT INTO reading_history (book_id, data, read_at) VALUES (?, ?, ?)", body.BookId, body.Data, time.Now().UnixMilli()); err != nil { tx.Rollback(); jsonErr(w, "insert failed: "+err.Error(), 500); return }
		if _, err := tx.Exec("DELETE FROM reading_history WHERE book_id NOT IN (SELECT book_id FROM reading_history ORDER BY read_at DESC LIMIT 500)"); err != nil { tx.Rollback(); jsonErr(w, "cleanup failed: "+err.Error(), 500); return }
		if err := tx.Commit(); err != nil { jsonErr(w, "tx commit failed: "+err.Error(), 500); return }
		jsonOK(w, map[string]string{"ok": "true"})
	case "DELETE":
		ids := r.URL.Query().Get("ids")
		if ids != "" {
			for _, id := range strings.Split(ids, ",") {
				if _, err := db.Meta.Exec("DELETE FROM reading_history WHERE book_id = ?", strings.TrimSpace(id)); err != nil { jsonErr(w, "delete failed: "+err.Error(), 500); return }
			}
		} else {
			if _, err := db.Meta.Exec("DELETE FROM reading_history"); err != nil { jsonErr(w, "clear failed: "+err.Error(), 500); return }
		}
		jsonOK(w, map[string]string{"ok": "true"})
	default:
		jsonErr(w, "method not allowed", 405)
	}
}

// ── Stats (Meta DB) ──
func handleStats(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		rows, err := db.Meta.Query("SELECT date, data FROM reading_stats ORDER BY date DESC LIMIT 365")
		if err != nil { jsonErr(w, "query failed: "+err.Error(), 500); return }
		defer rowsClose(rows)
		var items []map[string]any
		for rows.Next() { var date, data string; if rowsScan(rows, &date, &data) != nil { continue }; items = append(items, map[string]any{"date": date, "data": json.RawMessage(data)}) }
		if items == nil { items = []map[string]any{} }
		jsonOK(w, items)
	case "POST":
		var body struct{ Date string `json:"date"`; Data string `json:"data"` }; if err := decode(w, r, &body); err != nil { jsonErr(w, "invalid JSON", 400); return }
		if _, err := db.Meta.Exec("INSERT OR REPLACE INTO reading_stats (date, data) VALUES (?, ?)", body.Date, body.Data); err != nil { jsonErr(w, "write failed: "+err.Error(), 500); return }
		jsonOK(w, map[string]string{"ok": "true"})
	case "DELETE":
		dates := r.URL.Query().Get("dates")
		if dates != "" {
			for _, d := range strings.Split(dates, ",") {
				if _, err := db.Meta.Exec("DELETE FROM reading_stats WHERE date = ?", strings.TrimSpace(d)); err != nil { jsonErr(w, "delete failed: "+err.Error(), 500); return }
			}
		} else {
			if _, err := db.Meta.Exec("DELETE FROM reading_stats"); err != nil { jsonErr(w, "clear failed: "+err.Error(), 500); return }
		}
		jsonOK(w, map[string]string{"ok": "true"})
	default:
		jsonErr(w, "method not allowed", 405)
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
	if err := decode(w, r, &body); err != nil { jsonErr(w, "invalid JSON", 400); return }
	if body.Date == "" {
		jsonErr(w, "missing date", 400)
		return
	}
	type statData struct {
		MinutesRead int `json:"minutesRead"`
		BooksOpened int `json:"booksOpened"`
		PagesRead   int `json:"pagesRead"`
	}
	tx, err := db.Meta.Begin()
	if err != nil { jsonErr(w, "tx begin failed: "+err.Error(), 500); return }
	var existing sql.NullString
	if err := tx.QueryRow("SELECT data FROM reading_stats WHERE date = ?", body.Date).Scan(&existing); err != nil && err != sql.ErrNoRows { tx.Rollback(); jsonErr(w, "read failed: "+err.Error(), 500); return }
	var s statData
	if existing.Valid && existing.String != "" {
		if err := json.Unmarshal([]byte(existing.String), &s); err != nil { tx.Rollback(); jsonErr(w, "parse failed: "+err.Error(), 500); return }
	}
	s.BooksOpened += body.BooksOpened
	s.MinutesRead += body.MinutesRead
	s.PagesRead += body.PagesRead
	updated, err := json.Marshal(s)
	if err != nil { tx.Rollback(); jsonErr(w, "marshal failed: "+err.Error(), 500); return }
	if _, err := tx.Exec("INSERT OR REPLACE INTO reading_stats (date, data) VALUES (?, ?)", body.Date, string(updated)); err != nil { tx.Rollback(); jsonErr(w, "write failed: "+err.Error(), 500); return }
	if err := tx.Commit(); err != nil { jsonErr(w, "tx commit failed: "+err.Error(), 500); return }
	jsonOK(w, map[string]string{"ok": "true"})
}

// ── Theme / Settings (Settings DB) ──
func handleTheme(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		var v sql.NullString
		if err := db.Settings.QueryRow("SELECT value FROM config WHERE key = 'theme_mode'").Scan(&v); err != nil && err != sql.ErrNoRows { jsonErr(w, "query failed: "+err.Error(), 500); return }
		if v.Valid { jsonOK(w, v.String) } else { jsonOK(w, "light") }
	case "POST":
		var body struct{ Value string `json:"value"` }
		if err := decode(w, r, &body); err != nil { jsonErr(w, "invalid JSON", 400); return }
		if _, err := db.Settings.Exec("INSERT OR REPLACE INTO config (key, value) VALUES ('theme_mode', ?)", body.Value); err != nil { jsonErr(w, "write failed: "+err.Error(), 500); return }
		jsonOK(w, map[string]string{"ok": "true"})
	default:
		jsonErr(w, "method not allowed", 405)
	}
}
func handleSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		var v sql.NullString
		if err := db.Settings.QueryRow("SELECT value FROM config WHERE key = 'app_settings'").Scan(&v); err != nil && err != sql.ErrNoRows { jsonErr(w, "query failed: "+err.Error(), 500); return }
		if v.Valid { jsonOK(w, json.RawMessage(v.String)) } else {
			jsonOK(w, json.RawMessage(`{"readingSettings":{"fontSize":16},"toolbarAutoHideDelay":3000,"autoScrollSpeed":50}`))
		}
	case "POST":
		var body struct{ Settings json.RawMessage `json:"settings"` }
		if err := decode(w, r, &body); err != nil { jsonErr(w, "invalid JSON", 400); return }
		if _, err := db.Settings.Exec("INSERT OR REPLACE INTO config (key, value) VALUES ('app_settings', ?)", string(body.Settings)); err != nil { jsonErr(w, "write failed: "+err.Error(), 500); return }
		jsonOK(w, map[string]string{"ok": "true"})
	default:
		jsonErr(w, "method not allowed", 405)
	}
}

// ── Search (Meta DB) ──
func handleSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" { jsonOK(w, []any{}); return }
	if len(q) > 200 { q = q[:200] }
	// Limit results to prevent full table scan performance issues (M-10)
	rows, err := db.Meta.Query("SELECT id, title FROM books WHERE lower(title) LIKE ? OR lower(author) LIKE ? LIMIT 100", "%"+strings.ToLower(q)+"%", "%"+strings.ToLower(q)+"%")
	if err != nil { jsonErr(w, "search failed: "+err.Error(), 500); return }
	defer rowsClose(rows)
	type R struct{ BookID string `json:"bookId"`; BookTitle string `json:"bookTitle"`; MatchText string `json:"matchText"` }
	var results []R
	for rows.Next() { var id, title string; if rowsScan(rows, &id, &title) != nil { continue }; results = append(results, R{BookID: id, BookTitle: title, MatchText: title}) }
	if results == nil { results = []R{} }
	jsonOK(w, results)
}

// ── Parse / Import (stub, real parsing in frontend) ──
func handleParse(w http.ResponseWriter, r *http.Request) {
	var body struct{ FilePath string `json:"filePath"` }
	if err := decode(w, r, &body); err != nil { jsonErr(w, "invalid JSON", 400); return }
	if body.FilePath == "" { jsonErr(w, "missing filePath", 400); return }
	allowedExts := []string{".epub",".pdf",".txt",".md",".markdown",".html",".htm",".fb2",".djvu",".docx",".rtf",".odt",".cbz",".cbt",".chm",".lit",".lrf"}
	ok := false
	for _, ext := range allowedExts {
		if strings.HasSuffix(strings.ToLower(body.FilePath), ext) { ok = true; break }
	}
	if !ok {
		jsonErr(w, "unsupported format", 400)
		return
	}
	ext := fileExt(body.FilePath)
	jsonOK(w, map[string]any{"metadata": map[string]string{"title": fileTitle(body.FilePath), "author": "Unknown", "format": ext}, "chapters": []map[string]string{}})
}
func handleImport(w http.ResponseWriter, r *http.Request) {
	var body struct{ FilePath string `json:"filePath"` }
	if err := decode(w, r, &body); err != nil { jsonErr(w, "invalid JSON", 400); return }
	if body.FilePath == "" { jsonErr(w, "missing filePath", 400); return }
	b := Book{ID: newID(), Title: fileTitle(body.FilePath), Author: "Unknown", Path: body.FilePath, Format: fileExt(body.FilePath), AddedAt: time.Now().UnixMilli(), Tags: []string{}, LibraryID: "default"}
	if err := booksInsert(&b); err != nil { jsonErr(w, "insert failed: "+err.Error(), 500); return }
	jsonOK(w, b)
}

// ── Tags (server-side aggregation) ──
func handleTags(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" { jsonErr(w, "method not allowed", 405); return }
	rows, err := db.Meta.Query("SELECT DISTINCT json_each.value AS tag FROM books, json_each(books.tags) ORDER BY tag")
	if err != nil { jsonErr(w, "tags query failed: "+err.Error(), 500); return }
	defer rowsClose(rows)
	type TagEntry struct {
		Name  string `json:"name"`
		Count int    `json:"count"`
	}
	tagMap := make(map[string]int)
	for rows.Next() {
		var tag string
		if rowsScan(rows, &tag) != nil { continue }
		tagMap[tag]++
	}
	// Also count known_tags from config
	var knownTagsRaw sql.NullString
	if err := db.Settings.QueryRow("SELECT value FROM config WHERE key = 'known_tags'").Scan(&knownTagsRaw); err == nil && knownTagsRaw.Valid {
		var knownTags []string
		if err := json.Unmarshal([]byte(knownTagsRaw.String), &knownTags); err == nil {
			for _, t := range knownTags {
				if _, ok := tagMap[t]; !ok {
					tagMap[t] = 0
				}
			}
		}
	}
	var result []TagEntry
	for name, count := range tagMap {
		result = append(result, TagEntry{Name: name, Count: count})
	}
	// Sort by name
	sort.Slice(result, func(i, j int) bool {
		return result[i].Name < result[j].Name
	})
	if result == nil { result = []TagEntry{} }
	jsonOK(w, result)
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
		if size > 500<<20 {
			jsonErr(w, "file too large", 413)
			return
		}
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": filename}))
		w.Header().Set("Content-Length", strconv.FormatInt(size, 10))
		w.Write(data)
	case "POST":
		var body struct {
			Filename string `json:"filename"`
			Data     string `json:"data"` // base64 encoded
		}
		if err := decode(w, r, &body); err != nil { jsonErr(w, "invalid JSON", 400); return }
		raw, err := base64.StdEncoding.DecodeString(body.Data)
		if err != nil { jsonErr(w, "invalid base64", 400); return }
		if _, err := db.Content.Exec("INSERT OR REPLACE INTO raw_files (book_id, filename, data, size) VALUES (?, ?, ?, ?)", bookID, body.Filename, raw, len(raw)); err != nil { jsonErr(w, "write failed: "+err.Error(), 500); return }
		jsonOK(w, map[string]string{"ok": "true"})
	case "DELETE":
		if _, err := db.Content.Exec("DELETE FROM raw_files WHERE book_id = ?", bookID); err != nil { jsonErr(w, "delete failed: "+err.Error(), 500); return }
		jsonOK(w, map[string]string{"ok": "true"})
	default:
		jsonErr(w, "method not allowed", 405)
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
	if err := db.Meta.QueryRow("SELECT COUNT(*) FROM books"+where, args...).Scan(&total); err != nil {
		log.Printf("booksGet COUNT error: %v", err)
	}
	args = append(args, pageSize, (page-1)*pageSize)
	rows, err := db.Meta.Query("SELECT id,title,author,cover,path,format,size,added_at,last_read_at,progress,chapter_index,chapter_progress,tags,rating,review,word_count,chapter_count,total_reading_time,library_id,content_hash FROM books"+where+" ORDER BY added_at DESC LIMIT ? OFFSET ?", args...)
	if err != nil { return []Book{}, total }
	defer rowsClose(rows)
	var books []Book
	for rows.Next() {
		b := Book{}; var tagsStr string
		if rowsScan(rows, &b.ID, &b.Title, &b.Author, &b.Cover, &b.Path, &b.Format, &b.Size, &b.AddedAt, &b.LastReadAt, &b.Progress, &b.ChapterIndex, &b.ChapterProgress, &tagsStr, &b.Rating, &b.Review, &b.WordCount, &b.ChapterCount, &b.TotalReadingTime, &b.LibraryID, &b.ContentHash) != nil { continue }
		if err := json.Unmarshal([]byte(tagsStr), &b.Tags); err != nil { b.Tags = []string{} }
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
	if err := json.Unmarshal([]byte(tagsStr), &b.Tags); err != nil { b.Tags = []string{} }
	if b.Tags == nil { b.Tags = []string{} }
	return b, nil
}
func booksInsert(b *Book) error {
	tagsJSON, err := json.Marshal(b.Tags)
	if err != nil { return err }
	_, err = db.Meta.Exec(`INSERT OR REPLACE INTO books (id,title,author,cover,path,format,size,added_at,last_read_at,progress,chapter_index,chapter_progress,tags,rating,review,word_count,chapter_count,total_reading_time,library_id,content_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, b.ID, b.Title, b.Author, b.Cover, b.Path, b.Format, b.Size, b.AddedAt, b.LastReadAt, b.Progress, b.ChapterIndex, b.ChapterProgress, string(tagsJSON), b.Rating, b.Review, b.WordCount, b.ChapterCount, b.TotalReadingTime, b.LibraryID, b.ContentHash)
	return err
}
var allowedBookColumns = map[string]bool{
	"title": true, "author": true, "cover": true, "path": true, "format": true,
	"size": true, "added_at": true, "last_read_at": true, "progress": true,
	"chapter_index": true, "chapter_progress": true, "tags": true, "rating": true,
	"review": true, "word_count": true, "chapter_count": true,
	"total_reading_time": true, "library_id": true, "content_hash": true,
}

func bookUpdate(id string, u map[string]any) error {
	sets := []string{}
	args := []any{}
	for k, v := range u {
		dbKey := toSnake(k)
		if !allowedBookColumns[dbKey] {
			// Case-insensitive fallback
			for col := range allowedBookColumns {
				if strings.EqualFold(dbKey, col) { dbKey = col; break }
			}
			if !allowedBookColumns[dbKey] { continue }
		}
		if dbKey == "tags" {
			if arr, ok := v.([]any); ok {
				b, err := json.Marshal(arr)
				if err != nil { continue }
				v = string(b)
			}
		}
		sets = append(sets, dbKey+" = ?")
		args = append(args, v)
	}
	if len(sets) == 0 { return nil }
	args = append(args, id)
	_, err := db.Meta.Exec("UPDATE books SET "+strings.Join(sets, ", ")+" WHERE id = ?", args...)
	return err
}
func deleteBooks(ids []string) error {
	metaTx, err := db.Meta.Begin()
	if err != nil { return fmt.Errorf("tx begin failed: %w", err) }
	contentTx, err := db.Content.Begin()
	if err != nil { metaTx.Rollback(); return fmt.Errorf("content tx begin failed: %w", err) }
	for _, id := range ids {
		if _, err := metaTx.Exec("DELETE FROM books WHERE id = ?", id); err != nil { metaTx.Rollback(); contentTx.Rollback(); return fmt.Errorf("delete book %s failed: %w", id, err) }
		if _, err := contentTx.Exec("DELETE FROM chapters WHERE book_id = ?", id); err != nil { metaTx.Rollback(); contentTx.Rollback(); return fmt.Errorf("delete chapters %s failed: %w", id, err) }
		if _, err := contentTx.Exec("DELETE FROM raw_files WHERE book_id = ?", id); err != nil { metaTx.Rollback(); contentTx.Rollback(); return fmt.Errorf("delete raw_files %s failed: %w", id, err) }
	}
	if err := metaTx.Commit(); err != nil { contentTx.Rollback(); return fmt.Errorf("meta tx commit failed: %w", err) }
	if err := contentTx.Commit(); err != nil { return fmt.Errorf("content tx commit failed: %w", err) }
	return nil
}

// ── Utils ──
func toSnake(s string) string {
	var b strings.Builder
	for i, c := range s {
		if c >= 'A' && c <= 'Z' {
			if i > 0 { b.WriteByte('_') }
			b.WriteRune(c + 32) // lowercase ASCII
		} else {
			b.WriteRune(c)
		}
	}
	return b.String()
}
func newID() string { b := make([]byte, 8); if _, err := rand.Read(b); err != nil { panic("crypto/rand failed: " + err.Error()) }; return hex.EncodeToString(b) }
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

