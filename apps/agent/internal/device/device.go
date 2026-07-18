package device

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"runtime"

	"github.com/google/uuid"
)

type Device struct {
	DeviceID string `json:"deviceId"`
	Hostname string `json:"hostname"`
	OS       string `json:"os"`
	Arch     string `json:"arch"`
}

// dataFile resolves data/device.json next to the running binary rather
// than relative to the process's current working directory. Service
// managers (launchd, systemd) generally start the process with an
// unspecified/root cwd, so a bare relative path would silently fail to
// persist and mint a fresh device identity on every restart.
func dataFile() string {
	exe, err := os.Executable()
	if err != nil {
		return "data/device.json"
	}
	return filepath.Join(filepath.Dir(exe), "data", "device.json")
}

func New() Device {

	host, _ := os.Hostname()
	file := dataFile()

	// cek device lama
	data, err := os.ReadFile(file)

	if err == nil {

		var d Device

		if err := json.Unmarshal(data, &d); err != nil || d.DeviceID == "" {
			log.Println("device: stored device.json is invalid, generating a new identity:", err)
		} else {
			d.Hostname = host
			d.OS = runtime.GOOS
			d.Arch = runtime.GOARCH
			return d
		}
	}

	// buat device baru
	d := Device{

		DeviceID: uuid.New().String(),
		Hostname: host,
		OS: runtime.GOOS,
		Arch: runtime.GOARCH,

	}


	save, _ := json.MarshalIndent(
		d,
		"",
		"  ",
	)

	if err := os.MkdirAll(filepath.Dir(file), 0755); err != nil {
		log.Println("device: failed to create data dir, identity won't persist:", err)
	} else if err := os.WriteFile(file, save, 0644); err != nil {
		log.Println("device: failed to persist device.json, identity won't persist:", err)
	}


	return d

}
