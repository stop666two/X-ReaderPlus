package main

import (
	"context"
	"encoding/base64"
	"os"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

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

type FileInfo struct {
	Path  string `json:"path"`
	Name  string `json:"name"`
	Data  []byte `json:"data,omitempty"`
	Error string `json:"error,omitempty"`
	Size  int64  `json:"size,omitempty"`
}

func readFileInfo(path string) FileInfo {
	// Path comes from OS file dialog or internal usage, validated at the source
	data, err := os.ReadFile(path)
	info, statErr := os.Stat(path)
	fi := FileInfo{Path: path}
	if statErr == nil {
		fi.Name = info.Name()
		fi.Size = info.Size()
	}
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
		results = append(results, readFileInfo(p))
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
	fi := readFileInfo(path)
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
	return readFileInfo(path)
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
