package main

import "encoding/json"

// Book represents a book in the library
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

type ChapterContent struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

type ParsedBook struct {
	Metadata   BookMetadata     `json:"metadata"`
	Chapters   []ChapterContent `json:"chapters"`
	RawTOC     []TocItem        `json:"rawToc"`
	RawContent *string          `json:"rawContent,omitempty"`
}

type BookMetadata struct {
	Title  string `json:"title"`
	Author string `json:"author"`
	Cover  string `json:"cover"`
	Format string `json:"format"`
}

type TocItem struct {
	Label        string    `json:"label"`
	Href         string    `json:"href"`
	ChapterIndex int       `json:"chapterIndex"`
	Subitems     []TocItem `json:"subitems"`
}

type SearchResult struct {
	BookID        string `json:"bookId"`
	BookTitle     string `json:"bookTitle"`
	ChapterIndex  int    `json:"chapterIndex"`
	ChapterTitle  string `json:"chapterTitle"`
	MatchText     string `json:"matchText"`
	MatchPosition int    `json:"matchPosition"`
}

type Library struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Path      string `json:"path"`
	Mode      string `json:"mode"`
	CreatedAt int64  `json:"createdAt"`
	BookCount int    `json:"bookCount"`
}

// JSON helpers
func jsonStr(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func mustJSON(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}
