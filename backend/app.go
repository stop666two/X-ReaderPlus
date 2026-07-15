package main

import (
	"context"
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"sync"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

var trustedPaths = make(map[string]struct{})
var trustedPathsMu sync.RWMutex

const maxReadFileSize = 500 << 20 // 500MB limit for ReadFile

type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) shutdown(ctx context.Context) {
}

func (a *App) Minimize() {
	wailsRuntime.WindowMinimise(a.ctx)
}

func (a *App) Maximize() {
	if wailsRuntime.WindowIsMaximised(a.ctx) {
		wailsRuntime.WindowUnmaximise(a.ctx)
	} else {
		wailsRuntime.WindowMaximise(a.ctx)
	}
}

func (a *App) IsMaximized() bool {
	return wailsRuntime.WindowIsMaximised(a.ctx)
}

func (a *App) Close() {
	wailsRuntime.Quit(a.ctx)
}

func appDataDir() string {
	if cwd, err := os.Getwd(); err == nil {
		if _, err := os.Stat(filepath.Join(cwd, "data")); err == nil {
			abs, err := filepath.Abs(filepath.Join(cwd, "data"))
			if err != nil { return "" }
			return abs
		}
	}
	appdata := os.Getenv("APPDATA")
	if appdata == "" {
		appdata = filepath.Join(os.Getenv("HOME"), ".config")
	}
	dir := filepath.Join(appdata, "x-reader-plus", "X-ReaderPlus", "data")
	return dir
}

func pathAllowed(path string) bool {
	trustedPathsMu.RLock()
	_, ok := trustedPaths[path]
	trustedPathsMu.RUnlock()
	if ok {
		return true
	}
	if !filepath.IsAbs(path) {
		return false
	}
	clean := filepath.Clean(path)
	dataDir := appDataDir()
	if strings.HasPrefix(strings.ToLower(clean), strings.ToLower(dataDir)) {
		return true
	}
	return false
}

type FileInfo struct {
	Path  string `json:"path"`
	Name  string `json:"name"`
	Data  []byte `json:"data,omitempty"`
	Error string `json:"error,omitempty"`
	Size  int64  `json:"size,omitempty"`
}

func readFileInfoSafe(path string) FileInfo {
	info, statErr := os.Stat(path)
	fi := FileInfo{Path: path}
	if statErr == nil {
		fi.Name = info.Name()
		fi.Size = info.Size()
	}
	if statErr != nil {
		fi.Error = statErr.Error()
		return fi
	}
	if info.Size() > maxReadFileSize {
		fi.Error = "file too large"
		return fi
	}
	data, err := os.ReadFile(path)
	if err != nil {
		fi.Error = err.Error()
	} else {
		fi.Data = data
	}
	return fi
}

func (a *App) OpenFiles() ([]FileInfo, error) {
	paths, err := wailsRuntime.OpenMultipleFilesDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "选择文件",
	})
	if err != nil {
		return nil, err
	}
	var results []FileInfo
	for _, p := range paths {
		trustedPathsMu.Lock()
		trustedPaths[p] = struct{}{}
		trustedPathsMu.Unlock()
		results = append(results, readFileInfoSafe(p))
	}
	return results, nil
}

func (a *App) OpenFile() (*FileInfo, error) {
	path, err := wailsRuntime.OpenFileDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "选择文件",
	})
	if err != nil || path == "" {
		return nil, err
	}
	trustedPathsMu.Lock()
	trustedPaths[path] = struct{}{}
	trustedPathsMu.Unlock()
	fi := readFileInfoSafe(path)
	return &fi, nil
}

func (a *App) OpenFolder() (string, error) {
	return wailsRuntime.OpenDirectoryDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "选择文件夹",
	})
}

func (a *App) FileSizes(paths []string) ([]FileInfo, error) {
	// File paths come from the OS file dialog (user-initiated), no XSS risk
	var results []FileInfo
	for _, p := range paths {
		if !pathAllowed(p) {
			results = append(results, FileInfo{Path: p, Error: "access denied"})
			continue
		}
		info, err := os.Stat(p)
		fi := FileInfo{Path: p}
		if err != nil {
			fi.Error = err.Error()
		} else {
			fi.Name = info.Name()
			fi.Size = info.Size()
		}
		results = append(results, fi)
	}
	return results, nil
}

func (a *App) SaveFile(fileName string, dataB64 string) (string, error) {
	path, err := wailsRuntime.SaveFileDialog(a.ctx, wailsRuntime.SaveDialogOptions{
		DefaultFilename: fileName,
		Title:           "保存文件",
	})
	if err != nil || path == "" {
		return "", err
	}
	data, err := base64.StdEncoding.DecodeString(dataB64)
	if err != nil {
		return "", err
	}
	return path, os.WriteFile(path, data, 0644)
}

func (a *App) OpenExternal(url string) string {
	if len(url) < 8 || (url[:7] != "http://" && url[:8] != "https://" && url[:7] != "mailto:") {
		return "blocked"
	}
	wailsRuntime.BrowserOpenURL(a.ctx, url)
	return "ok"
}

func (a *App) ReadFile(path string) FileInfo {
	if !pathAllowed(path) {
		return FileInfo{Path: path, Error: "access denied"}
	}
	return readFileInfoSafe(path)
}

func (a *App) GetAppDir() string {
	dir, _ := os.UserHomeDir()
	return dir
}

func (a *App) ShowMessage(title, message string) {
	wailsRuntime.MessageDialog(a.ctx, wailsRuntime.MessageDialogOptions{
		Title:   title,
		Message: message,
	})
}
