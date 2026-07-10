package files

import (
	"os"
	"path/filepath"
	"sort"
)

type Entry struct {
	Name    string `json:"name"`
	IsDir   bool   `json:"isDir"`
	Size    int64  `json:"size"`
	ModTime int64  `json:"modTime"` // unix seconds
}

// HomeDir returns the user's home directory, used as the starting point
// for browsing when the dashboard hasn't picked a path yet.
func HomeDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return "."
	}
	return home
}

// List returns the contents of dir, directories first, then files,
// both alphabetical.
func List(dir string) ([]Entry, error) {

	items, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	out := make([]Entry, 0, len(items))

	for _, item := range items {

		info, err := item.Info()
		if err != nil {
			continue // skip entries we can't stat (permissions, broken symlinks, etc.)
		}

		out = append(out, Entry{
			Name:    item.Name(),
			IsDir:   item.IsDir(),
			Size:    info.Size(),
			ModTime: info.ModTime().Unix(),
		})
	}

	sort.Slice(out, func(i, j int) bool {
		if out[i].IsDir != out[j].IsDir {
			return out[i].IsDir // dirs first
		}
		return out[i].Name < out[j].Name
	})

	return out, nil
}

// Read returns the full contents of a file. Intended for reasonably sized
// files — the whole thing is buffered into memory and sent as one binary
// WebSocket frame, no chunking yet.
func Read(path string) ([]byte, error) {
	return os.ReadFile(path)
}

// Write creates/overwrites a file with the given bytes.
func Write(path string, data []byte) error {
	return os.WriteFile(path, data, 0644)
}

// Delete removes a file or directory (recursively, for directories).
func Delete(path string) error {
	return os.RemoveAll(path)
}

// Rename renames a file/directory within the same parent directory.
func Rename(path, newName string) error {
	dir := filepath.Dir(path)
	return os.Rename(path, filepath.Join(dir, newName))
}

// Mkdir creates a new directory under parent.
func Mkdir(parent, name string) error {
	return os.Mkdir(filepath.Join(parent, name), 0755)
}
