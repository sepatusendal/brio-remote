import express from "express";
import http from "http";
import cors from "cors";
import { BrioSocket } from "./websocket/server.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
    res.json({ ok: true });
});

const server = http.createServer(app);

new BrioSocket(server);

server.listen(3000, () => {
    console.log("🚀 Brio Server running on :3000");
});
