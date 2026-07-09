import { WebSocketServer } from "ws";

export class BrioSocket {

    constructor(server){

        this.wss = new WebSocketServer({
            server
        });

        console.log("✅ WebSocket initialized");

        this.wss.on("connection",(ws,req)=>{

            console.log("🟢 NEW CONNECTION");

            console.log(req.socket.remoteAddress);

            ws.on("message",(msg)=>{

                console.log("📩",msg.toString());

            });

            ws.on("close",()=>{

                console.log("❌ CLOSED");

            });

        });

    }

}
