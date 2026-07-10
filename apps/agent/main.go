// Brio Remote — device agent
// Made by Wira Mode Pohon
package main

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/sepatusendal/brio-remote/agent/internal/capture"
	"github.com/sepatusendal/brio-remote/agent/internal/control"
	"github.com/sepatusendal/brio-remote/agent/internal/device"
	"github.com/sepatusendal/brio-remote/agent/internal/files"
	"github.com/sepatusendal/brio-remote/agent/internal/procs"
	"github.com/sepatusendal/brio-remote/agent/internal/shell"
	"github.com/sepatusendal/brio-remote/agent/internal/stats"
	"github.com/sepatusendal/brio-remote/agent/internal/system"
)

// defaultServerURL can be baked in at build time via:
//   go build -ldflags "-X main.defaultServerURL=wss://your-tailscale-ip:3000"
// so a binary handed to a client needs zero configuration. Falls back to
// the BRIO_SERVER_URL env var, then to localhost for local dev.
var defaultServerURL string

const (
	streamFPS    = 12
	jpegQuality  = 55
	statsPeriod  = 3 * time.Second
	procListSize = 25

	baseReconnectDelay = 1 * time.Second
	maxReconnectDelay  = 30 * time.Second
	heartbeatInterval  = 5 * time.Second
)

// Binary frames are prefixed with a 1-byte type tag so the dashboard can
// tell a continuous stream frame apart from a one-off screenshot, even
// though the server relays both as opaque binary blobs.
const (
	frameTypeStream     byte = 0x01
	frameTypeScreenshot byte = 0x02
	frameTypeFileDown   byte = 0x03
	frameTypeFileUp     byte = 0x04
	frameTypeTermOut    byte = 0x05 // agent -> viewer, raw pty output
	frameTypeTermIn     byte = 0x06 // viewer -> agent, raw keystrokes
)

// safeConn wraps a websocket.Conn with a mutex, since gorilla/websocket
// connections do not support concurrent writes from multiple goroutines.
// We write from the heartbeat loop, the stream loop, the stats loop, and
// one-off request replies.
type safeConn struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

func (s *safeConn) writeJSON(v any) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.conn.WriteJSON(v)
}

func (s *safeConn) writeBinary(tag byte, payload []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.conn.WriteMessage(websocket.BinaryMessage, append([]byte{tag}, payload...))
}

func main() {

	log.Println("Brio Agent v0.7")

	serverURL := os.Getenv("BRIO_SERVER_URL")
	if serverURL == "" {
		serverURL = defaultServerURL
	}
	if serverURL == "" {
		serverURL = "ws://localhost:3000"
	}

	info := device.New()
	sysInfo := system.GetInfo() // cached once; CPU model doesn't change at runtime

	log.Println("DeviceID:", info.DeviceID)
	log.Println("CPU:", sysInfo.CPUModel)

	// Outer reconnect loop: runs for the lifetime of the process. Every
	// dropped connection (network blip, laptop sleep/wake, server
	// restart, whatever) falls back out to here and retries with
	// exponential backoff, capped at maxReconnectDelay — all within this
	// same process, no reliance on the OS service manager restarting a
	// crashed process. That still happens as a last-resort safety net
	// (see the launchd/Task Scheduler/systemd installers), but day-to-day
	// reconnects should never need it.
	delay := baseReconnectDelay

	for {
		err := runSession(serverURL, info, sysInfo, &delay)
		if err != nil {
			log.Println("session ended:", err)
		}

		log.Printf("reconnecting in %s...\n", delay)
		time.Sleep(delay)

		delay *= 2
		if delay > maxReconnectDelay {
			delay = maxReconnectDelay
		}
	}
}

// runSession dials the server, runs the full agent session (heartbeat,
// command handling, streaming, terminal, files) until the connection
// drops for any reason, then returns. All session-scoped state
// (streaming, termShell, etc.) lives here so each reconnect starts clean.
func runSession(serverURL string, info device.Device, sysInfo system.Info, delay *time.Duration) error {

	rawConn, _, err := websocket.DefaultDialer.Dial(serverURL, nil)
	if err != nil {
		return err
	}
	defer rawConn.Close()

	// Reset backoff now that we're actually connected — a brief blip
	// shouldn't leave us waiting 30s for the *next* one.
	*delay = baseReconnectDelay

	conn := &safeConn{conn: rawConn}
	log.Println("Connected to", serverURL)

	var (
		streaming  bool
		stopStream chan struct{}

		statsRunning bool
		stopStats    chan struct{}

		termShell *shell.Shell

		pendingUploadPath string
	)

	// Make sure nothing from this session (stream goroutine, stats
	// goroutine, pty shell) outlives the connection it belongs to.
	defer func() {
		if streaming {
			close(stopStream)
		}
		if statsRunning {
			close(stopStats)
		}
		if termShell != nil {
			termShell.Close()
		}
	}()

	readErr := make(chan error, 1)

	// Listen for commands/session control/input from the server.
	go func() {

		for {

			msgType, msg, err := rawConn.ReadMessage()
			if err != nil {
				readErr <- err
				return
			}

			if msgType == websocket.BinaryMessage {

				if len(msg) < 1 {
					continue
				}

				tag, payload := msg[0], msg[1:]

				switch tag {

				case frameTypeFileUp:
					if pendingUploadPath != "" {
						err := files.Write(pendingUploadPath, payload)
						if err != nil {
							conn.writeJSON(map[string]any{"type": "FILE_OP_RESULT", "ok": false, "error": err.Error()})
						} else {
							conn.writeJSON(map[string]any{"type": "FILE_OP_RESULT", "ok": true})
						}
						pendingUploadPath = ""
					}

				case frameTypeTermIn:
					if termShell != nil {
						termShell.Write(payload)
					}
				}

				continue
			}

			var cmd map[string]any
			if err := json.Unmarshal(msg, &cmd); err != nil {
				continue
			}

			switch cmd["type"] {

			case "SESSION_START":
				log.Println("🖥️  Command Center session opened")
				if !statsRunning {
					statsRunning = true
					stopStats = make(chan struct{})
					go statsLoop(conn, stopStats)
				}
				if termShell == nil {
					sh, err := shell.New(func(data []byte) {
						conn.writeBinary(frameTypeTermOut, data)
					})
					if err != nil {
						log.Println("shell start error:", err)
					} else {
						termShell = sh
						log.Println("💻 Terminal shell started")
					}
				}

			case "SESSION_STOP":
				if streaming {
					streaming = false
					close(stopStream)
				}
				if statsRunning {
					statsRunning = false
					close(stopStats)
				}
				if termShell != nil {
					termShell.Close()
					termShell = nil
					log.Println("💻 Terminal shell closed")
				}
				log.Println("🖥️  Command Center session closed")

			case "STREAM_START":
				if !streaming {
					streaming = true
					stopStream = make(chan struct{})
					go streamLoop(conn, stopStream)
					log.Println("🎥 Live stream started")
				}

			case "STREAM_STOP":
				if streaming {
					streaming = false
					close(stopStream)
					log.Println("⏹️  Live stream stopped")
				}

			case "SCREENSHOT_REQUEST":
				frame, err := capture.JPEG(80) // higher quality for a single still
				if err != nil {
					log.Println("screenshot error:", err)
					continue
				}
				if err := conn.writeBinary(frameTypeScreenshot, frame); err != nil {
					log.Println("screenshot send error:", err)
				} else {
					log.Println("📷 Screenshot sent")
				}

			case "PROCESS_LIST_REQUEST":
				sendProcessList(conn)

			case "PROCESS_KILL":
				pidF, _ := cmd["pid"].(float64)
				if pidF == 0 {
					continue
				}
				if err := procs.Kill(int32(pidF)); err != nil {
					log.Println("kill error:", err)
					conn.writeJSON(map[string]any{"type": "PROCESS_KILL_RESULT", "pid": int32(pidF), "ok": false, "error": err.Error()})
				} else {
					log.Println("🔪 Killed PID", int32(pidF))
					conn.writeJSON(map[string]any{"type": "PROCESS_KILL_RESULT", "pid": int32(pidF), "ok": true})
				}
				sendProcessList(conn)

			case "TERM_RESIZE":
				colsF, _ := cmd["cols"].(float64)
				rowsF, _ := cmd["rows"].(float64)
				if termShell != nil && colsF > 0 && rowsF > 0 {
					termShell.Resize(int(colsF), int(rowsF))
				}

			case "FILES_LIST_REQUEST":
				path, _ := cmd["path"].(string)
				if path == "" {
					path = files.HomeDir()
				}
				entries, err := files.List(path)
				if err != nil {
					conn.writeJSON(map[string]any{"type": "FILE_OP_RESULT", "ok": false, "error": err.Error()})
					continue
				}
				conn.writeJSON(map[string]any{"type": "FILES_LIST", "path": path, "entries": entries})

			case "FILE_DOWNLOAD_REQUEST":
				path, _ := cmd["path"].(string)
				data, err := files.Read(path)
				if err != nil {
					conn.writeJSON(map[string]any{"type": "FILE_OP_RESULT", "ok": false, "error": err.Error()})
					continue
				}
				conn.writeJSON(map[string]any{
					"type": "FILE_DOWNLOAD_START", "path": path,
					"filename": filepath.Base(path), "size": len(data),
				})
				conn.writeBinary(frameTypeFileDown, data)

			case "FILE_UPLOAD_START":
				path, _ := cmd["path"].(string)
				pendingUploadPath = path

			case "FILE_DELETE":
				path, _ := cmd["path"].(string)
				if err := files.Delete(path); err != nil {
					conn.writeJSON(map[string]any{"type": "FILE_OP_RESULT", "ok": false, "error": err.Error()})
				} else {
					conn.writeJSON(map[string]any{"type": "FILE_OP_RESULT", "ok": true})
				}

			case "FILE_RENAME":
				path, _ := cmd["path"].(string)
				newName, _ := cmd["newName"].(string)
				if err := files.Rename(path, newName); err != nil {
					conn.writeJSON(map[string]any{"type": "FILE_OP_RESULT", "ok": false, "error": err.Error()})
				} else {
					conn.writeJSON(map[string]any{"type": "FILE_OP_RESULT", "ok": true})
				}

			case "FILE_MKDIR":
				parent, _ := cmd["path"].(string)
				name, _ := cmd["name"].(string)
				if err := files.Mkdir(parent, name); err != nil {
					conn.writeJSON(map[string]any{"type": "FILE_OP_RESULT", "ok": false, "error": err.Error()})
				} else {
					conn.writeJSON(map[string]any{"type": "FILE_OP_RESULT", "ok": true})
				}

			case "INPUT":
				var ev control.Event
				b, _ := json.Marshal(cmd)
				if err := json.Unmarshal(b, &ev); err == nil {
					control.Apply(ev)
				}

			case "COMMAND":
				if cmd["action"] == "PING" {
					log.Println("🏓 PONG")
				}
			}

		}

	}()

	// Heartbeat loop. Selects on both the ticker and the read-goroutine's
	// error channel, so a dropped connection is noticed immediately
	// instead of waiting up to heartbeatInterval for the next failed
	// write to discover it.
	ticker := time.NewTicker(heartbeatInterval)
	defer ticker.Stop()

	for {
		select {

		case err := <-readErr:
			return err

		case <-ticker.C:

			payload := map[string]any{
				"type":      "HEARTBEAT",
				"deviceId":  info.DeviceID,
				"hostname":  info.Hostname,
				"os":        info.OS,
				"arch":      info.Arch,
				"cpuModel":  sysInfo.CPUModel,
				"timestamp": time.Now().Unix(),
			}

			if err := conn.writeJSON(payload); err != nil {
				return err
			}

			log.Println("Heartbeat")
		}
	}
}

// streamLoop captures the screen at streamFPS and pushes tagged JPEG
// frames over the connection until stop is closed. It only runs while the
// viewer has the Screen tab open, so an idle Command Center session costs
// near-zero bandwidth.
func streamLoop(conn *safeConn, stop chan struct{}) {

	interval := time.Second / time.Duration(streamFPS)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {

		case <-stop:
			return

		case <-ticker.C:

			frame, err := capture.JPEG(jpegQuality)
			if err != nil {
				log.Println("capture error:", err)
				continue
			}

			if err := conn.writeBinary(frameTypeStream, frame); err != nil {
				log.Println("frame send error:", err)
				return
			}
		}
	}
}

// statsLoop pushes a CPU/memory snapshot every statsPeriod for as long as
// the Command Center session is open (independent of whether the Screen
// tab is streaming).
func statsLoop(conn *safeConn, stop chan struct{}) {

	ticker := time.NewTicker(statsPeriod)
	defer ticker.Stop()

	for {
		select {

		case <-stop:
			return

		case <-ticker.C:

			snap := stats.Take()

			payload := map[string]any{
				"type":       "STATS",
				"cpuPercent": snap.CPUPercent,
				"memPercent": snap.MemPercent,
				"memUsedMB":  snap.MemUsedMB,
				"memTotalMB": snap.MemTotalMB,
			}

			if err := conn.writeJSON(payload); err != nil {
				log.Println("stats send error:", err)
				return
			}
		}
	}
}

func sendProcessList(conn *safeConn) {

	list, err := procs.List(procListSize)
	if err != nil {
		log.Println("process list error:", err)
		return
	}

	if err := conn.writeJSON(map[string]any{"type": "PROCESS_LIST", "processes": list}); err != nil {
		log.Println("process list send error:", err)
	}
}
