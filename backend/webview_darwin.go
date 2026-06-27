//go:build darwin

package main

import (
	"log"
	"net/http"
	"time"

	"github.com/webview/webview_go"
)

func runWebview(port string, srv *http.Server) {
	url := "http://127.0.0.1:" + port

	if !waitForServer(url+"/", 5*time.Second) {
		log.Fatal("Server did not become ready in time")
	}

	w := webview.New(false)
	if w == nil {
		log.Fatal("Cannot create window")
	}
	defer w.Destroy()

	w.SetTitle("X-ReaderPlus")
	w.SetSize(1280, 800, webview.HintNone)

	w.Bind("close", func() {
		w.Terminate()
	})

	w.Init(`
window.__xr_native_titlebar = true;
(function() {
	var retries = 0;
	var check = setInterval(function() {
		retries++;
		if (window.electronAPI) {
			clearInterval(check);
			window.electronAPI.close = function() { window.close && window.close(); };
		} else if (retries > 200) {
			clearInterval(check);
		}
	}, 50);
})();
`)

	w.Navigate(url)
	w.Run()

	log.Println("Window closed, shutting down...")
}
