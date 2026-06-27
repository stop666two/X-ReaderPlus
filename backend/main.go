package main

import (
	"log"
	"net/http"
	"os"

	"x-reader-plus/backend/api"
	"x-reader-plus/backend/db"
)

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

func main() {
	log.SetFlags(log.LstdFlags)

	if err := db.Init(); err != nil {
		log.Fatalf("DB init failed: %v", err)
	}
	defer db.Close()

	mux := http.NewServeMux()
	api.Register(mux)

	port := os.Getenv("PORT")
	if port == "" {
		port = "34123"
	}

	handler := corsMiddleware(mux)

	log.Printf("Go backend on http://127.0.0.1:%s", port)
	if err := http.ListenAndServe("127.0.0.1:"+port, handler); err != nil {
		log.Fatalf("Server: %v", err)
	}
}
