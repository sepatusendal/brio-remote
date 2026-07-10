package system

import (
	"os"
	"runtime"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/host"
)

type Info struct {
	Hostname string `json:"hostname"`
	OS       string `json:"os"`
	Arch     string `json:"arch"`
	Uptime   uint64 `json:"uptime"`
	CPUModel string `json:"cpuModel"`
}

// GetInfo collects a snapshot of machine info. CPU model lookup can be
// slow-ish (spawns OS queries on some platforms), so callers should cache
// the result rather than calling this on every heartbeat.
func GetInfo() Info {

	hostname, _ := os.Hostname()
	uptime, _ := host.Uptime()

	cpuModel := "unknown"
	if stats, err := cpu.Info(); err == nil && len(stats) > 0 {
		cpuModel = stats[0].ModelName
	}

	return Info{
		Hostname: hostname,
		OS:       runtime.GOOS,
		Arch:     runtime.GOARCH,
		Uptime:   uptime,
		CPUModel: cpuModel,
	}
}
