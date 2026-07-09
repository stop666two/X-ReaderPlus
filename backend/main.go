package main

import (
	"context"
	"embed"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	"x-reader-plus/backend/api"
	"x-reader-plus/backend/db"
)

//go:embed all:frontend
var frontendRaw embed.FS

func frontendAssets() fs.FS {
	ffs, err := fs.Sub(frontendRaw, "frontend")
	if err != nil {
		return nil
	}
	return ffs
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		next.ServeHTTP(w, r)
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Server binds only to 127.0.0.1 — reflect any origin (only local clients can reach)
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "http://127.0.0.1:34123")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func startAPIServer(port string) *http.Server {
	mux := http.NewServeMux()
	api.Register(mux)

	// Serve embedded frontend for browser access
	if ffs := frontendAssets(); ffs != nil {
		mux.Handle("/", http.FileServer(http.FS(ffs)))
	}

	listener, err := net.Listen("tcp", "127.0.0.1:"+port)
	if err != nil {
		log.Fatalf("Cannot listen on port %s: %v", port, err)
	}

	handler := securityHeaders(corsMiddleware(mux))
	srv := &http.Server{
		Handler:           handler,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("Server on http://127.0.0.1:%s", port)
		if err := srv.Serve(listener); err != nil && err != http.ErrServerClosed {
			log.Printf("API server error: %v", err)
		}
	}()

	return srv
}

func main() {
	log.SetFlags(log.LstdFlags)

	if err := db.Init(); err != nil {
		log.Fatalf("DB init failed: %v", err)
	}
	defer db.Close()

	port := os.Getenv("PORT")
	if port == "" {
		port = "34123"
	}

	apiSrv := startAPIServer(port)

	app := NewApp()

	assetsFS := frontendAssets()

	err := wails.Run(&options.App{
		Title:     "X-ReaderPlus",
		Width:     1280,
		Height:    800,
		MinWidth:  800,
		MinHeight: 600,
		Frameless: true,
		AssetServer: &assetserver.Options{
			Assets: assetsFS,
		},
		OnStartup:  app.startup,
		OnShutdown: app.shutdown,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		log.Fatalf("Wails app error: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	apiSrv.Shutdown(ctx)
}
