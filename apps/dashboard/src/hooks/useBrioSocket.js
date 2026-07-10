import { useCallback, useEffect, useRef, useState } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3000";

// Must match the tag bytes the Go agent prefixes onto binary frames.
const FRAME_TYPE_STREAM = 0x01;
const FRAME_TYPE_SCREENSHOT = 0x02;

let logSeq = 0;

export function useBrioSocket() {

    const wsRef = useRef(null);
    const streamHandlerRef = useRef(null);

    const [connected, setConnected] = useState(false);
    const [viewerId, setViewerId] = useState(null);
    const [devices, setDevices] = useState([]);
    // session: null | { deviceId, status: "connecting" | "active" | "rejected", reason? }
    const [session, setSession] = useState(null);
    const [activityLog, setActivityLog] = useState([]);
    const [screenshot, setScreenshot] = useState(null); // object URL of last screenshot

    const pushLog = useCallback((label) => {
        setActivityLog((prev) => [
            { id: ++logSeq, ts: Date.now(), label },
            ...prev,
        ].slice(0, 50));
    }, []);

    useEffect(() => {

        const ws = new WebSocket(WS_URL);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        ws.onopen = () => {
            setConnected(true);
            ws.send(JSON.stringify({ type: "VIEWER_HELLO" }));
        };

        ws.onclose = () => setConnected(false);

        ws.onerror = (err) => console.error("WS error:", err);

        ws.onmessage = (evt) => {

            if (evt.data instanceof ArrayBuffer) {

                const bytes = new Uint8Array(evt.data);
                const tag = bytes[0];
                const payload = evt.data.slice(1);

                if (tag === FRAME_TYPE_STREAM) {
                    streamHandlerRef.current?.(payload);
                } else if (tag === FRAME_TYPE_SCREENSHOT) {
                    const blob = new Blob([payload], { type: "image/jpeg" });
                    setScreenshot((old) => {
                        if (old) URL.revokeObjectURL(old);
                        return URL.createObjectURL(blob);
                    });
                    pushLog("Screenshot captured");
                }
                return;
            }

            let msg;
            try {
                msg = JSON.parse(evt.data);
            } catch {
                return;
            }

            switch (msg.type) {

                case "VIEWER_ID":
                    setViewerId(msg.viewerId);
                    break;

                case "DEVICE_LIST":
                    setDevices(msg.devices);
                    break;

                case "CONNECT_ACCEPTED":
                    setSession({ deviceId: msg.deviceId, status: "active" });
                    pushLog(`Connected to ${msg.deviceId}`);
                    break;

                case "CONNECT_REJECTED":
                    setSession({ deviceId: msg.deviceId, status: "rejected", reason: msg.reason });
                    break;

                case "SESSION_ENDED":
                    setSession(null);
                    pushLog(msg.reason || "Session ended");
                    break;

                default:
                    break;
            }
        };

        return () => ws.close();

    }, [pushLog]);

    const requestConnect = useCallback((deviceId) => {
        setSession({ deviceId, status: "connecting" });
        setActivityLog([]);
        setScreenshot(null);
        wsRef.current?.send(JSON.stringify({ type: "CONNECT_REQUEST", deviceId }));
    }, []);

    const endSession = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: "DISCONNECT_SESSION" }));
        setSession(null);
    }, []);

    const sendInput = useCallback((event) => {
        wsRef.current?.send(JSON.stringify({ type: "INPUT", ...event }));
    }, []);

    const startStream = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: "STREAM_START" }));
        pushLog("Screen stream started");
    }, [pushLog]);

    const stopStream = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: "STREAM_STOP" }));
        pushLog("Screen stream stopped");
    }, [pushLog]);

    const requestScreenshot = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: "SCREENSHOT_REQUEST" }));
        pushLog("Screenshot requested");
    }, [pushLog]);

    const onStreamFrame = useCallback((handler) => {
        streamHandlerRef.current = handler;
    }, []);

    return {
        connected,
        viewerId,
        devices,
        session,
        activityLog,
        screenshot,
        requestConnect,
        endSession,
        sendInput,
        startStream,
        stopStream,
        requestScreenshot,
        onStreamFrame,
    };
}
