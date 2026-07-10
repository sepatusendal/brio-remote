// Brio Remote — relay server
// Made by Wira Mode Pohon
import express from "express";
import http from "http";
import cors from "cors";
import { BrioSocket, devices } from "./websocket/server.js";


const app = express();

app.use(cors());
app.use(express.json());


app.get("/health",(req,res)=>{

    res.json({
        ok:true
    });

});


app.get("/devices",(req,res)=>{

    res.json(
        Array.from(devices.values())
    );

});

// NOTE: session negotiation (connect/control/streaming) now happens entirely
// over the WebSocket protocol (VIEWER_HELLO / CONNECT_REQUEST / INPUT). The
// old REST /connect endpoint only ever sent a bare PING and is removed.


const server = http.createServer(app);


new BrioSocket(server);

const PORT = process.env.PORT || 3000;

server.listen(PORT,()=>{

    console.log(
        `🚀 Brio Server running :${PORT}`
    );

});
