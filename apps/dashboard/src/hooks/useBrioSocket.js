import { useCallback, useEffect, useRef, useState } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3000";

export function useBrioSocket() {

    const wsRef = useRef(null);
    const frameHandlerRef = useRef(null);

    const [connected, setConnected] = useState(false);
    const [viewerId, setViewerId] = useState(null);
    const [devices, setDevices] = useState([]);
    // session: null | { deviceId, status: "connecting" | "active" | "rejected", reason? }
    const [session, setSession] = useState(null);

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
                frameHandlerRef.current?.(evt.data);
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
                    break;

                case "CONNECT_REJECTED":
                    setSession({ deviceId: msg.deviceId, status: "rejected", reason: msg.reason });
                    break;

                case "SESSION_ENDED":
                    setSession(null);
                    break;

                default:
                    break;
            }
        };

        return () => ws.close();

    }, []);

    const requestConnect = useCallback((deviceId) => {
        setSession({ deviceId, status: "connecting" });
        wsRef.current?.send(JSON.stringify({ type: "CONNECT_REQUEST", deviceId }));
    }, []);

    const endSession = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: "DISCONNECT_SESSION" }));
        setSession(null);
    }, []);

    const sendInput = useCallback((event) => {
        wsRef.current?.send(JSON.stringify({ type: "INPUT", ...event }));
    }, []);

    const onFrame = useCallback((handler) => {
        frameHandlerRef.current = handler;
    }, []);

    return { connected, viewerId, devices, session, requestConnect, endSession, sendInput, onFrame };
}
