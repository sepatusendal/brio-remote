package main

import (
	"log"
	"time"

	"github.com/gorilla/websocket"
)

func main() {

	log.Println("===================================")
	log.Println(" Brio Agent v0.1")
	log.Println("===================================")

	conn, _, err := websocket.DefaultDialer.Dial("ws://localhost:3000", nil)

	if err != nil {
		log.Fatal(err)
	}

	defer conn.Close()

	log.Println("Connected to Brio Server")

	for {

		err := conn.WriteMessage(
			websocket.TextMessage,
			[]byte(`{"type":"heartbeat"}`),
		)

		if err != nil {
			log.Println(err)
			break
		}

		log.Println("Heartbeat sent")

		time.Sleep(5 * time.Second)

	}

}
