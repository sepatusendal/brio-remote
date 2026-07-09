package main

import (
	"log"
	"time"

	"github.com/gorilla/websocket"
)

func main() {

	log.Println("Brio Agent v0.1")

	conn, _, err := websocket.DefaultDialer.Dial(
		"ws://localhost:3000",
		nil,
	)

	if err != nil {
		log.Fatal("Server tidak aktif:", err)
	}

	defer conn.Close()

	log.Println("Connected")

	for {

		message := `{
			"type":"HEARTBEAT",
			"device":"BRIO-TEST"
		}`

		err := conn.WriteMessage(
			websocket.TextMessage,
			[]byte(message),
		)

		if err != nil {
			log.Println(err)
			break
		}

		log.Println("Heartbeat sent")

		time.Sleep(5 * time.Second)
	}
}
