import express from "express";
import http from "http";
import cors from "cors";

import { BrioSocket } from "./websocket/server.js";
import { getDevices } from "./devices/registry.js";

const app = express();

app.use(cors());
app.use(express.json());

// health check
app.get("/health", (req, res) => {
  res.json({
    service: "brio-server",
    status: "ok",
  });
});

// device list
app.get("/devices", (req, res) => {
  res.json(getDevices());
});

const server = http.createServer(app);

// websocket
new BrioSocket(server);

server.listen(3000, () => {
  console.log("🚀 Brio Server running on :3000");
});
