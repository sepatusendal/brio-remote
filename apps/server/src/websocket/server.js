import { WebSocketServer } from "ws";
import { updateDevice } from "../devices/registry.js";

export class BrioSocket {
  constructor(server) {
    this.wss = new WebSocketServer({
      server,
    });

    console.log("✅ WebSocket initialized");

    this.wss.on("connection", (ws, req) => {
      console.log("🟢 NEW CONNECTION");

      ws.on("message", (msg) => {
        const data = JSON.parse(msg.toString());

        if (data.type === "HEARTBEAT") {
          const device = updateDevice(data);

          console.log("DEVICE ONLINE", device.hostname);
        }
      });
    });
  }
}
