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

const (
	streamFPS    = 12
	jpegQuality  = 55
	statsPeriod  = 3 * time.Second
	procListSize = 25
)

// Binary frames are prefixed with a 1-byte type tag so the dashboard can
// tell a continuous stream frame apart from a one-off screenshot, even
// though the server relays both as opaque binary blobs.
const (
	frameTypeStream     byte = 0x01
	frameTypeScreenshot byte = 0x02
	frameTypeFileDown   byte = 0x03
	frameTypeFileUp     byte = 0x04
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

	log.Println("Brio Agent v0.6")

	serverURL := os.Getenv("BRIO_SERVER_URL")
	if serverURL == "" {
		serverURL = "ws://localhost:3000"
	}

	info := device.New()
	sysInfo := system.GetInfo() // cached once; CPU model doesn't change at runtime

	log.Println("DeviceID:", info.DeviceID)
	log.Println("CPU:", sysInfo.CPUModel)

	rawConn, _, err := websocket.DefaultDialer.Dial(serverURL, nil)
	if err != nil {
		log.Fatal(err)
	}
	defer rawConn.Close()

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

	// Listen for commands/session control/input from the server.
	go func() {

		for {

			msgType, msg, err := rawConn.ReadMessage()
			if err != nil {
				log.Println("read error:", err)
				return
			}

			if msgType == websocket.BinaryMessage {

				if len(msg) < 1 {
					continue
				}

				tag, payload := msg[0], msg[1:]

				if tag == frameTypeFileUp && pendingUploadPath != "" {
					err := files.Write(pendingUploadPath, payload)
					if err != nil {
						conn.writeJSON(map[string]any{"type": "FILE_OP_RESULT", "ok": false, "error": err.Error()})
					} else {
						conn.writeJSON(map[string]any{"type": "FILE_OP_RESULT", "ok": true})
					}
					pendingUploadPath = ""
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
					sh, err := shell.New(
						func(stream, line string) {
							conn.writeJSON(map[string]any{"type": "EXEC_OUTPUT", "stream": stream, "line": line})
						},
						func(exitCode int) {
							conn.writeJSON(map[string]any{"type": "EXEC_DONE", "exitCode": exitCode})
						},
					)
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

			case "EXEC_REQUEST":
				command, _ := cmd["command"].(string)
				if command == "" || termShell == nil {
					continue
				}
				if err := termShell.Run(command); err != nil {
					log.Println("exec error:", err)
					conn.writeJSON(map[string]any{"type": "EXEC_OUTPUT", "stream": "stderr", "line": "brio: failed to run command: " + err.Error()})
					conn.writeJSON(map[string]any{"type": "EXEC_DONE", "exitCode": -1})
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

	// Heartbeat loop (main goroutine).
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for range ticker.C {

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
			log.Println("heartbeat error:", err)
			return
		}

		log.Println("Heartbeat")
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
