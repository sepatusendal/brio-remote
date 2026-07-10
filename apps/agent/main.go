package main

import (
	"encoding/json"
	"log"
	"os"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/sepatusendal/brio-remote/agent/internal/capture"
	"github.com/sepatusendal/brio-remote/agent/internal/control"
	"github.com/sepatusendal/brio-remote/agent/internal/device"
	"github.com/sepatusendal/brio-remote/agent/internal/system"
)

const (
	streamFPS   = 12
	jpegQuality = 55
)

// Binary frames are prefixed with a 1-byte type tag so the dashboard can
// tell a continuous stream frame apart from a one-off screenshot, even
// though the server relays both as opaque binary blobs.
const (
	frameTypeStream     byte = 0x01
	frameTypeScreenshot byte = 0x02
)

// safeConn wraps a websocket.Conn with a mutex, since gorilla/websocket
// connections do not support concurrent writes from multiple goroutines.
// We write from the heartbeat loop, the stream loop, and one-off
// screenshot replies.
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

	log.Println("Brio Agent v0.5")

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
	)

	// Listen for commands/session control/input from the server.
	go func() {

		for {

			_, msg, err := rawConn.ReadMessage()
			if err != nil {
				log.Println("read error:", err)
				return
			}

			var cmd map[string]any
			if err := json.Unmarshal(msg, &cmd); err != nil {
				continue
			}

			switch cmd["type"] {

			case "SESSION_START":
				// A viewer opened the Command Center for this device.
				// Nothing to do yet beyond logging — screenshot/terminal/
				// etc. requests are handled independently below.
				log.Println("🖥️  Command Center session opened")

			case "SESSION_STOP":
				if streaming {
					streaming = false
					close(stopStream)
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
