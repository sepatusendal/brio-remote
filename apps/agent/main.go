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
)

const (
	streamFPS   = 12
	jpegQuality = 55
)

// safeConn wraps a websocket.Conn with a mutex, since gorilla/websocket
// connections do not support concurrent writes from multiple goroutines.
// We write from both the heartbeat loop and the frame-streaming loop.
type safeConn struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

func (s *safeConn) writeJSON(v any) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.conn.WriteJSON(v)
}

func (s *safeConn) writeBinary(b []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.conn.WriteMessage(websocket.BinaryMessage, b)
}

func main() {

	log.Println("Brio Agent v0.4")

	serverURL := os.Getenv("BRIO_SERVER_URL")
	if serverURL == "" {
		serverURL = "ws://localhost:3000"
	}

	info := device.New()
	log.Println("DeviceID:", info.DeviceID)

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
				if !streaming {
					streaming = true
					stopStream = make(chan struct{})
					go streamLoop(conn, stopStream)
					log.Println("🎥 Session started, streaming...")
				}

			case "SESSION_STOP":
				if streaming {
					streaming = false
					close(stopStream)
					log.Println("⏹️  Session stopped")
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
			"timestamp": time.Now().Unix(),
		}

		if err := conn.writeJSON(payload); err != nil {
			log.Println("heartbeat error:", err)
			return
		}

		log.Println("Heartbeat")
	}
}

// streamLoop captures the screen at streamFPS and pushes JPEG frames over
// the connection until stop is closed. It runs in its own goroutine, only
// while a viewer session is active, so idle agents cost near-zero bandwidth.
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

			if err := conn.writeBinary(frame); err != nil {
				log.Println("frame send error:", err)
				return
			}
		}
	}
}
