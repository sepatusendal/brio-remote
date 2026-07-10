import { WebSocketServer } from "ws";

export const clients = new Map();
export const devices = new Map();

export class BrioSocket {

    constructor(server) {

        const wss = new WebSocketServer({ server });

        console.log("✅ WebSocket initialized");


        wss.on("connection",(ws)=>{

            console.log("🟢 NEW CONNECTION");


            ws.on("message",(message)=>{

                const data = JSON.parse(message.toString());


                if(data.type === "HEARTBEAT"){


                    clients.set(
                        data.deviceId,
                        ws
                    );


                    devices.set(
                        data.deviceId,
                        {
                            deviceId:data.deviceId,
                            hostname:data.hostname,
                            os:data.os,
                            arch:data.arch,
                            lastSeen:Date.now(),
                            online:true
                        }
                    );


                    console.log(
                        "❤️",
                        data.hostname
                    );


                }


            });



            ws.on("close",()=>{


                for(const [id,socket] of clients){


                    if(socket === ws){

                        clients.delete(id);


                        if(devices.has(id)){

                            devices.get(id).online=false;

                        }

                    }

                }


                console.log("❌ DISCONNECTED");


            });


        });


    }

}
