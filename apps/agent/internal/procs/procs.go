package procs

import (
	"sort"

	gopsproc "github.com/shirou/gopsutil/v4/process"
)

type ProcInfo struct {
	PID        int32   `json:"pid"`
	Name       string  `json:"name"`
	CPUPercent float64 `json:"cpuPercent"`
	MemMB      float64 `json:"memMB"`
}

// List returns the top `limit` processes by CPU usage. Best-effort: a
// process that exits mid-scan or denies access is simply skipped rather
// than failing the whole request.
func List(limit int) ([]ProcInfo, error) {

	pids, err := gopsproc.Processes()
	if err != nil {
		return nil, err
	}

	out := make([]ProcInfo, 0, len(pids))

	for _, p := range pids {

		name, err := p.Name()
		if err != nil || name == "" {
			continue
		}

		cpuPct, _ := p.CPUPercent()
		memInfo, err := p.MemoryInfo()

		var memMB float64
		if err == nil && memInfo != nil {
			memMB = float64(memInfo.RSS) / 1024 / 1024
		}

		out = append(out, ProcInfo{
			PID:        p.Pid,
			Name:       name,
			CPUPercent: cpuPct,
			MemMB:      memMB,
		})
	}

	sort.Slice(out, func(i, j int) bool {
		return out[i].CPUPercent > out[j].CPUPercent
	})

	if limit > 0 && len(out) > limit {
		out = out[:limit]
	}

	return out, nil
}

// Kill terminates the process with the given PID.
func Kill(pid int32) error {
	p, err := gopsproc.NewProcess(pid)
	if err != nil {
		return err
	}
	return p.Kill()
}
