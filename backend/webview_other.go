//go:build !windows && !darwin && !linux

package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
)

func runWebview(port string, _ *http.Server) {
	log.Printf("Open http://127.0.0.1:%s in your browser", port)
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh
}
