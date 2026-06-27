package main

import (
	"context"
	"embed"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"x-reader-plus/backend/api"
	"x-reader-plus/backend/db"
)

//go:embed all:frontend
var frontendRaw embed.FS

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func tryGetFrontend() (e fs.FS, ok bool) {
	ffs, err := fs.Sub(frontendRaw, "frontend")
	if err != nil {
		return nil, false
	}
	if _, err := ffs.Open("index.html"); err != nil {
		return nil, false
	}
	return ffs, true
}

func waitForServer(url string, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		resp, err := http.Get(url)
		if err == nil {
			resp.Body.Close()
			return true
		}
		time.Sleep(100 * time.Millisecond)
	}
	return false
}

func main() {
	log.SetFlags(log.LstdFlags)

	if err := db.Init(); err != nil {
		log.Fatalf("DB init failed: %v", err)
	}
	defer db.Close()

	mux := http.NewServeMux()
	api.Register(mux)

	frontendFS, hasFrontend := tryGetFrontend()
	if hasFrontend {
		mux.Handle("/", http.FileServer(http.FS(frontendFS)))
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "34123"
	}

	listener, err := net.Listen("tcp", "127.0.0.1:"+port)
	if err != nil {
		log.Fatalf("Cannot listen on port %s: %v", port, err)
	}

	handler := corsMiddleware(mux)
	srv := &http.Server{Handler: handler}

	go func() {
		log.Printf("X-ReaderPlus on http://127.0.0.1:%s", port)
		if err := srv.Serve(listener); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server: %v", err)
		}
	}()

	noWebview := os.Getenv("XREADER_NO_WEBVIEW") == "1"

	if hasFrontend && !noWebview {
		runWebview(port, srv)

		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
	} else {
		log.Println("API-only mode")
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("Shutting down...")
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
	}
}
