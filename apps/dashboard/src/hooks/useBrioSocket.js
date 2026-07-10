import { useCallback, useEffect, useRef, useState } from "react";

// If VITE_WS_URL isn't set, default to same-origin — this is what makes
// the built dashboard "just work" with zero config once the server is
// serving it directly (see apps/server/src/index.js), whatever host/IP
// it's reached at (localhost, LAN IP, Tailscale IP, etc).
function resolveWsUrl() {
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
    if (typeof window === "undefined") return "ws://localhost:3000";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}`;
}

const WS_URL = resolveWsUrl();

// Must match the tag bytes the Go agent prefixes onto binary frames.
const FRAME_TYPE_STREAM = 0x01;
const FRAME_TYPE_SCREENSHOT = 0x02;
const FRAME_TYPE_FILE_DOWN = 0x03;
const FRAME_TYPE_FILE_UP = 0x04;
const FRAME_TYPE_TERM_OUT = 0x05;
const FRAME_TYPE_TERM_IN = 0x06;

let logSeq = 0;

function sendTaggedBinary(ws, tag, arrayBuffer) {
    const out = new Uint8Array(arrayBuffer.byteLength + 1);
    out[0] = tag;
    out.set(new Uint8Array(arrayBuffer), 1);
    ws.send(out.buffer);
}

function triggerBrowserDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function useBrioSocket(token) {

    const wsRef = useRef(null);
    const streamHandlerRef = useRef(null);
    const termOutputHandlerRef = useRef(null);
    const pendingDownloadRef = useRef(null); // { filename, size } set by FILE_DOWNLOAD_START

    const [connected, setConnected] = useState(false);
    const [viewerId, setViewerId] = useState(null);
    const [devices, setDevices] = useState([]);
    // session: null | { deviceId, status: "connecting" | "active" | "rejected", reason? }
    const [session, setSession] = useState(null);
    const [activityLog, setActivityLog] = useState([]);
    const [screenshot, setScreenshot] = useState(null); // object URL of last screenshot
    const [authError, setAuthError] = useState(null);
    const [statsHistory, setStatsHistory] = useState([]); // rolling buffer of {cpuPercent, memPercent, memUsedMB, memTotalMB, ts}
    const [processes, setProcesses] = useState([]);
    const [fileList, setFileList] = useState(null); // { path, entries }
    const [fileTransfer, setFileTransfer] = useState(null); // { kind: 'download'|'upload', name } | null

    const pushLog = useCallback((label) => {
        setActivityLog((prev) => [
            { id: ++logSeq, ts: Date.now(), label },
            ...prev,
        ].slice(0, 50));
    }, []);

    useEffect(() => {

        if (!token) return undefined;

        const ws = new WebSocket(WS_URL);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        ws.onopen = () => {
            setConnected(true);
            setAuthError(null);
            ws.send(JSON.stringify({ type: "VIEWER_HELLO", token }));
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
                } else if (tag === FRAME_TYPE_FILE_DOWN) {
                    const meta = pendingDownloadRef.current;
                    const blob = new Blob([payload]);
                    triggerBrowserDownload(blob, meta?.filename);
                    pushLog(`Downloaded ${meta?.filename || "file"}`);
                    setFileTransfer(null);
                    pendingDownloadRef.current = null;
                } else if (tag === FRAME_TYPE_TERM_OUT) {
                    termOutputHandlerRef.current?.(payload);
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

                case "AUTH_FAILED":
                    setAuthError(msg.reason || "Invalid access token");
                    break;

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

                case "STATS":
                    setStatsHistory((prev) => [
                        ...prev,
                        {
                            cpuPercent: msg.cpuPercent,
                            memPercent: msg.memPercent,
                            memUsedMB: msg.memUsedMB,
                            memTotalMB: msg.memTotalMB,
                            ts: Date.now(),
                        },
                    ].slice(-30));
                    break;

                case "PROCESS_LIST":
                    setProcesses(msg.processes || []);
                    break;

                case "PROCESS_KILL_RESULT":
                    pushLog(msg.ok ? `Killed process ${msg.pid}` : `Failed to kill ${msg.pid}: ${msg.error}`);
                    break;

                case "FILES_LIST":
                    setFileList({ path: msg.path, entries: msg.entries || [] });
                    break;

                case "FILE_DOWNLOAD_START":
                    pendingDownloadRef.current = { filename: msg.filename, size: msg.size };
                    break;

                case "FILE_OP_RESULT":
                    setFileTransfer(null);
                    if (!msg.ok) pushLog(`File operation failed: ${msg.error}`);
                    break;

                default:
                    break;
            }
        };

        return () => ws.close();

    }, [pushLog, token]);

    const requestConnect = useCallback((deviceId) => {
        setSession({ deviceId, status: "connecting" });
        setActivityLog([]);
        setScreenshot(null);
        setStatsHistory([]);
        setProcesses([]);
        setFileList(null);
        setFileTransfer(null);
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

    const requestProcessList = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: "PROCESS_LIST_REQUEST" }));
    }, []);

    const killProcess = useCallback((pid) => {
        wsRef.current?.send(JSON.stringify({ type: "PROCESS_KILL", pid }));
    }, []);

    const sendTermInput = useCallback((arrayBuffer) => {
        if (wsRef.current) sendTaggedBinary(wsRef.current, FRAME_TYPE_TERM_IN, arrayBuffer);
    }, []);

    const sendTermResize = useCallback((cols, rows) => {
        wsRef.current?.send(JSON.stringify({ type: "TERM_RESIZE", cols, rows }));
    }, []);

    const onTermOutput = useCallback((handler) => {
        termOutputHandlerRef.current = handler;
    }, []);

    const requestFilesList = useCallback((path) => {
        wsRef.current?.send(JSON.stringify({ type: "FILES_LIST_REQUEST", path: path || "" }));
    }, []);

    const downloadFile = useCallback((path) => {
        setFileTransfer({ kind: "download", name: path.split("/").pop() });
        wsRef.current?.send(JSON.stringify({ type: "FILE_DOWNLOAD_REQUEST", path }));
    }, []);

    const uploadFile = useCallback((path, file) => {
        setFileTransfer({ kind: "upload", name: file.name });
        wsRef.current?.send(JSON.stringify({ type: "FILE_UPLOAD_START", path }));

        file.arrayBuffer().then((buf) => {
            if (wsRef.current) sendTaggedBinary(wsRef.current, FRAME_TYPE_FILE_UP, buf);
            pushLog(`Uploaded ${file.name}`);
        });
    }, [pushLog]);

    const deleteFile = useCallback((path) => {
        wsRef.current?.send(JSON.stringify({ type: "FILE_DELETE", path }));
        pushLog(`Deleted ${path.split("/").pop()}`);
    }, [pushLog]);

    const renameFile = useCallback((path, newName) => {
        wsRef.current?.send(JSON.stringify({ type: "FILE_RENAME", path, newName }));
        pushLog(`Renamed to ${newName}`);
    }, [pushLog]);

    const makeDirectory = useCallback((path, name) => {
        wsRef.current?.send(JSON.stringify({ type: "FILE_MKDIR", path, name }));
        pushLog(`Created folder ${name}`);
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
        authError,
        statsHistory,
        processes,
        fileList,
        fileTransfer,
        requestConnect,
        endSession,
        sendInput,
        startStream,
        stopStream,
        requestScreenshot,
        requestProcessList,
        killProcess,
        sendTermInput,
        sendTermResize,
        onTermOutput,
        requestFilesList,
        downloadFile,
        uploadFile,
        deleteFile,
        renameFile,
        makeDirectory,
        onStreamFrame,
    };
}
