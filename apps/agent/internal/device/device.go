package device

import (
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

func New() Device {

	host, _ := os.Hostname()

	return Device{
		DeviceID: uuid.New().String(),
		Hostname: host,
		OS:       runtime.GOOS,
		Arch:     runtime.GOARCH,
	}
}
