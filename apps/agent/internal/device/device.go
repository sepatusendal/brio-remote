package device

import (
	"encoding/json"
	"os"
	"runtime"

	"github.com/google/uuid"
)

type Device struct {
	DeviceID string `json:"deviceId"`
	Hostname string `json:"hostname"`
	OS       string `json:"os"`
	Arch     string `json:"arch"`
}

const file = "data/device.json"

func New() Device {

	host, _ := os.Hostname()

	// cek device lama
	data, err := os.ReadFile(file)

	if err == nil {

		var d Device

		json.Unmarshal(data, &d)

		d.Hostname = host
		d.OS = runtime.GOOS
		d.Arch = runtime.GOARCH

		return d
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


	os.WriteFile(
		file,
		save,
		0644,
	)


	return d

}
