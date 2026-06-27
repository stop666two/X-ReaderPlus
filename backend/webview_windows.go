//go:build windows

package main

import (
	"log"
	"net/http"
	"time"
	"unsafe"

	"github.com/jchv/go-webview2"
	"golang.org/x/sys/windows"
)

var (
	_user32           = windows.NewLazySystemDLL("user32.dll")
	_procShowWindow   = _user32.NewProc("ShowWindow")
	_procSetWindowPos = _user32.NewProc("SetWindowPos")
	_procPostQuit     = _user32.NewProc("PostQuitMessage")
	_procIsZoomed     = _user32.NewProc("IsZoomed")
	_procGetWindowLong = _user32.NewProc("GetWindowLongPtrW")
	_procSetWindowLong = _user32.NewProc("SetWindowLongPtrW")

	_dwmapi  = windows.NewLazySystemDLL("dwmapi.dll")
	_procDwm = _dwmapi.NewProc("DwmExtendFrameIntoClientArea")
)

const (
	GWLP_STYLE  uintptr = ^uintptr(15) // -16
	WS_CAPTION         = 0x00C00000
	WS_SYSMENU         = 0x00080000
	WS_POPUP           = 0x80000000

	SW_MINIMIZE = 2
	SW_MAXIMIZE = 3
	SW_RESTORE  = 1

	SWP_NOZORDER     = 0x0004
	SWP_NOMOVE       = 0x0002
	SWP_NOSIZE       = 0x0001
	SWP_FRAMECHANGED = 0x0020
	SWP_NOACTIVATE   = 0x0010
)

func winShowWindow(hwnd uintptr, cmd int32) {
	_procShowWindow.Call(hwnd, uintptr(cmd))
}

func winSetWindowPos(hwnd uintptr, flags uint32) {
	_procSetWindowPos.Call(hwnd, 0, 0, 0, 0, 0, uintptr(flags))
}

func winPostQuit() {
	_procPostQuit.Call(0)
}

func winIsZoomed(hwnd uintptr) bool {
	r, _, _ := _procIsZoomed.Call(hwnd)
	return r != 0
}

func winGetWindowLong(hwnd uintptr) uintptr {
	r, _, _ := _procGetWindowLong.Call(hwnd, GWLP_STYLE)
	return r
}

func winSetWindowLong(hwnd uintptr, style uintptr) {
	_procSetWindowLong.Call(hwnd, GWLP_STYLE, style)
}

func winExtendFrame(hwnd uintptr) {
	margins := [4]int32{0, 0, 1, 0}
	_procDwm.Call(hwnd, uintptr(unsafe.Pointer(&margins[0])))
}

func runWebview(port string, srv *http.Server) {
	url := "http://127.0.0.1:" + port

	if !waitForServer(url+"/", 5*time.Second) {
		log.Fatal("Server did not become ready in time")
	}

	w := webview2.NewWithOptions(webview2.WebViewOptions{
		Debug: false,
		WindowOptions: webview2.WindowOptions{
			Title:  "X-ReaderPlus",
			Width:  1280,
			Height: 800,
			Center: true,
		},
	})

	if w == nil {
		log.Fatal("Cannot create window. Ensure WebView2 Runtime is installed.")
	}

	defer w.Destroy()

	w.Dispatch(func() {
		hwnd := uintptr(w.Window())

		style := winGetWindowLong(hwnd)
		style &^= WS_CAPTION | WS_SYSMENU
		style |= WS_POPUP
		winSetWindowLong(hwnd, style)

		winSetWindowPos(hwnd, SWP_NOZORDER|SWP_NOMOVE|SWP_NOSIZE|SWP_FRAMECHANGED|SWP_NOACTIVATE)
		winExtendFrame(hwnd)

		w.SetSize(1280, 800, webview2.HintNone)
	})

	w.Bind("minimize", func() {
		w.Dispatch(func() {
			winShowWindow(uintptr(w.Window()), SW_MINIMIZE)
		})
	})

	w.Bind("maximize", func() {
		w.Dispatch(func() {
			hwnd := uintptr(w.Window())
			if winIsZoomed(hwnd) {
				winShowWindow(hwnd, SW_RESTORE)
			} else {
				winShowWindow(hwnd, SW_MAXIMIZE)
			}
		})
	})

	w.Bind("close", func() {
		w.Dispatch(func() {
			winPostQuit()
		})
	})

	w.Init(`
(function() {
	var retries = 0;
	var check = setInterval(function() {
		retries++;
		if (window.electronAPI) {
			clearInterval(check);
			window.electronAPI.minimize = function() { window.minimize && window.minimize(); };
			window.electronAPI.maximize = function() { window.maximize && window.maximize(); };
			window.electronAPI.close   = function() { window.close   && window.close(); };
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
