import { WebSocketServer } from "ws";
import { randomUUID } from "crypto";

// deviceId -> device metadata (used by /devices REST + broadcast to viewers)
export const devices = new Map();

// Connection registries
const agentSockets = new Map();  // deviceId -> ws
const viewerSockets = new Map(); // viewerId -> ws

// Session pairing (1 viewer <-> 1 device at a time, MVP)
const sessionsByDevice = new Map(); // deviceId -> viewerId
const sessionsByViewer = new Map(); // viewerId -> deviceId

function safeSend(ws, obj) {
    if (ws && ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(obj));
    }
}

function broadcastDeviceList() {
    const payload = JSON.stringify({
        type: "DEVICE_LIST",
        devices: Array.from(devices.values()),
    });

    for (const ws of viewerSockets.values()) {
        if (ws.readyState === ws.OPEN) ws.send(payload);
    }
}

function endSession(deviceId, viewerId, { notifyAgent = true, notifyViewer = true, reason } = {}) {
    if (deviceId) sessionsByDevice.delete(deviceId);
    if (viewerId) sessionsByViewer.delete(viewerId);

    if (deviceId) {
        const dev = devices.get(deviceId);
        if (dev) dev.inSession = false;

        if (notifyAgent) {
            safeSend(agentSockets.get(deviceId), { type: "SESSION_STOP" });
        }
    }

    if (viewerId && notifyViewer) {
        safeSend(viewerSockets.get(viewerId), { type: "SESSION_ENDED", reason: reason || "Session ended" });
    }

    broadcastDeviceList();
}

export class BrioSocket {

    constructor(server) {

        const wss = new WebSocketServer({ server });

        console.log("✅ WebSocket initialized");

        wss.on("connection", (ws) => {

            ws.role = null;
            ws.deviceId = null;
            ws.viewerId = null;

            console.log("🟢 NEW CONNECTION");

            ws.on("message", (message, isBinary) => {

                // Binary frames only ever come from an agent mid-session: relay to its paired viewer.
                if (isBinary) {
                    if (ws.role === "agent" && ws.deviceId) {
                        const viewerId = sessionsByDevice.get(ws.deviceId);
                        const viewerWs = viewerId && viewerSockets.get(viewerId);
                        if (viewerWs && viewerWs.readyState === viewerWs.OPEN) {
                            viewerWs.send(message, { binary: true });
                        }
                    }
                    return;
                }

                let data;
                try {
                    data = JSON.parse(message.toString());
                } catch {
                    return;
                }

                switch (data.type) {

                    case "HEARTBEAT": {

                        ws.role = "agent";
                        ws.deviceId = data.deviceId;

                        agentSockets.set(data.deviceId, ws);

                        devices.set(data.deviceId, {
                            deviceId: data.deviceId,
                            hostname: data.hostname,
                            os: data.os,
                            arch: data.arch,
                            lastSeen: Date.now(),
                            online: true,
                            inSession: sessionsByDevice.has(data.deviceId),
                        });

                        broadcastDeviceList();
                        break;
                    }

                    case "VIEWER_HELLO": {

                        ws.role = "viewer";
                        ws.viewerId = randomUUID();

                        viewerSockets.set(ws.viewerId, ws);

                        safeSend(ws, { type: "VIEWER_ID", viewerId: ws.viewerId });
                        safeSend(ws, { type: "DEVICE_LIST", devices: Array.from(devices.values()) });
                        break;
                    }

                    case "CONNECT_REQUEST": {

                        if (ws.role !== "viewer") return;

                        const targetId = data.deviceId;
                        const agentWs = agentSockets.get(targetId);

                        if (!agentWs || agentWs.readyState !== agentWs.OPEN) {
                            safeSend(ws, { type: "CONNECT_REJECTED", deviceId: targetId, reason: "Device offline" });
                            return;
                        }

                        if (sessionsByDevice.has(targetId)) {
                            safeSend(ws, { type: "CONNECT_REJECTED", deviceId: targetId, reason: "Device sedang dipakai viewer lain" });
                            return;
                        }

                        sessionsByDevice.set(targetId, ws.viewerId);
                        sessionsByViewer.set(ws.viewerId, targetId);

                        const dev = devices.get(targetId);
                        if (dev) dev.inSession = true;

                        safeSend(agentWs, { type: "SESSION_START" });
                        safeSend(ws, { type: "CONNECT_ACCEPTED", deviceId: targetId });

                        broadcastDeviceList();
                        break;
                    }

                    case "INPUT": {

                        if (ws.role !== "viewer") return;

                        const deviceId = sessionsByViewer.get(ws.viewerId);
                        const agentWs = deviceId && agentSockets.get(deviceId);

                        if (agentWs) safeSend(agentWs, { type: "INPUT", ...data });
                        break;
                    }

                    case "DISCONNECT_SESSION": {

                        const deviceId = sessionsByViewer.get(ws.viewerId);
                        if (deviceId) endSession(deviceId, ws.viewerId, { notifyViewer: false, reason: "Disconnected by viewer" });
                        break;
                    }

                    default:
                        break;
                }

            });

            ws.on("close", () => {

                if (ws.role === "agent" && ws.deviceId) {

                    agentSockets.delete(ws.deviceId);

                    if (devices.has(ws.deviceId)) {
                        devices.get(ws.deviceId).online = false;
                    }

                    const viewerId = sessionsByDevice.get(ws.deviceId);
                    if (viewerId) {
                        endSession(ws.deviceId, viewerId, { notifyAgent: false, reason: "Device disconnected" });
                    } else {
                        broadcastDeviceList();
                    }
                }

                if (ws.role === "viewer" && ws.viewerId) {

                    viewerSockets.delete(ws.viewerId);

                    const deviceId = sessionsByViewer.get(ws.viewerId);
                    if (deviceId) {
                        endSession(deviceId, ws.viewerId, { notifyViewer: false, reason: "Viewer disconnected" });
                    }
                }

                console.log("❌ DISCONNECTED");

            });

        });

    }

}
