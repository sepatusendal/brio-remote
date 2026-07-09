package system

import (
	"os"
	"runtime"

	"github.com/shirou/gopsutil/v4/host"
)

type Info struct {
	Hostname string `json:"hostname"`
	OS       string `json:"os"`
	Arch     string `json:"arch"`
	Uptime   uint64 `json:"uptime"`
}

func GetInfo() Info {

	hostname, _ := os.Hostname()

	uptime, _ := host.Uptime()

	return Info{
		Hostname: hostname,
		OS: runtime.GOOS,
		Arch: runtime.GOARCH,
		Uptime: uptime,
	}
}
