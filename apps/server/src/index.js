// Brio Remote — relay server
// Made by Wira Mode Pohon
import express from "express";
import http from "http";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { ACCESS_TOKEN, BrioSocket, devices } from "./websocket/server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD_DIST = path.join(__dirname, "..", "..", "dashboard", "dist");

const app = express();

app.use(cors());
app.use(express.json());


app.get("/health",(req,res)=>{

    res.json({
        ok:true
    });

});


// Device metadata (hostnames, OS, CPU model) is only for authenticated
// operators — same token the dashboard uses to open a viewer session.
app.get("/devices",(req,res)=>{

    const token = req.get("Authorization")?.replace(/^Bearer\s+/i, "") || req.query.token;

    if (token !== ACCESS_TOKEN) {
        return res.status(401).json({ error: "Invalid or missing access token" });
    }

    res.json(
        Array.from(devices.values())
    );

});

// NOTE: session negotiation (connect/control/streaming) now happens entirely
// over the WebSocket protocol (VIEWER_HELLO / CONNECT_REQUEST / INPUT). The
// old REST /connect endpoint only ever sent a bare PING and is removed.

// Serve the dashboard's production build (run `npm run build` in
// apps/dashboard first) so the whole app is one process on one port —
// no separate `npm run dev` needed for day-to-day use. The dashboard's
// WS client defaults to same-origin, so this just works with zero config
// once both are running from the same host/port.
app.use(express.static(DASHBOARD_DIST));

app.get(/(.*)/, (req, res, next) => {
    if (req.path.startsWith("/health") || req.path.startsWith("/devices")) return next();
    res.sendFile(path.join(DASHBOARD_DIST, "index.html"), (err) => {
        if (err) next();
    });
});


const server = http.createServer(app);


new BrioSocket(server);

const PORT = process.env.PORT || 3000;

server.listen(PORT,()=>{

    console.log(
        `🚀 Brio Server running :${PORT}`
    );

});
