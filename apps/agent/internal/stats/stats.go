package stats

import (
	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/mem"
)

type Snapshot struct {
	CPUPercent float64 `json:"cpuPercent"`
	MemPercent float64 `json:"memPercent"`
	MemUsedMB  uint64  `json:"memUsedMB"`
	MemTotalMB uint64  `json:"memTotalMB"`
}

// Take samples current CPU load (blocking ~200ms for a short measurement
// window) and memory usage. Cheap enough to call every few seconds from a
// polling loop.
func Take() Snapshot {

	snap := Snapshot{}

	if pct, err := cpu.Percent(200_000_000, false); err == nil && len(pct) > 0 {
		snap.CPUPercent = pct[0]
	}

	if vm, err := mem.VirtualMemory(); err == nil {
		snap.MemPercent = vm.UsedPercent
		snap.MemUsedMB = vm.Used / 1024 / 1024
		snap.MemTotalMB = vm.Total / 1024 / 1024
	}

	return snap
}
