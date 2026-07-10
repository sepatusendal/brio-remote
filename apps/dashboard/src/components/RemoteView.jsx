import { useEffect, useRef, useState } from "react";

export default function RemoteView({ deviceId, sendInput, onFrame, onClose }) {

    const canvasRef = useRef(null);
    const lastMoveRef = useRef(0);

    // Rolling window of recent frame arrivals, used to derive a genuine
    // fps/throughput readout instead of a fake animated number.
    const frameLogRef = useRef([]);
    const [stats, setStats] = useState({ fps: 0, kbps: 0 });

    useEffect(() => {

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        onFrame(async (buffer) => {

            const now = performance.now();
            frameLogRef.current.push({ t: now, bytes: buffer.byteLength });
            frameLogRef.current = frameLogRef.current.filter((f) => now - f.t <= 2000);

            const blob = new Blob([buffer], { type: "image/jpeg" });
            const bitmap = await createImageBitmap(blob);

            if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
            }

            ctx.drawImage(bitmap, 0, 0);
            bitmap.close();
        });

        return () => onFrame(null);

    }, [onFrame]);

    // Recompute the HUD readout twice a second from the rolling frame log.
    useEffect(() => {
        const id = setInterval(() => {
            const log = frameLogRef.current;
            const windowSec = 2;
            const fps = log.length / windowSec;
            const totalBytes = log.reduce((sum, f) => sum + f.bytes, 0);
            const kbps = (totalBytes * 8) / 1000 / windowSec;
            setStats({ fps, kbps });
        }, 500);
        return () => clearInterval(id);
    }, []);

    function toRemoteCoords(e) {
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width || 1;
        const scaleY = canvasRef.current.height / rect.height || 1;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    }

    function buttonName(e) {
        if (e.button === 2) return "right";
        if (e.button === 1) return "middle";
        return "left";
    }

    function handleMouseMove(e) {
        const now = Date.now();
        if (now - lastMoveRef.current < 33) return;
        lastMoveRef.current = now;
        sendInput({ action: "mousemove", ...toRemoteCoords(e) });
    }

    function handleMouseDown(e) {
        sendInput({ action: "mousedown", ...toRemoteCoords(e), button: buttonName(e) });
    }

    function handleMouseUp(e) {
        sendInput({ action: "mouseup", ...toRemoteCoords(e), button: buttonName(e) });
    }

    function handleWheel(e) {
        sendInput({ action: "wheel", deltaY: e.deltaY });
    }

    function handleKeyDown(e) {
        e.preventDefault();
        sendInput({ action: "keydown", key: e.key });
    }

    function handleKeyUp(e) {
        e.preventDefault();
        sendInput({ action: "keyup", key: e.key });
    }

    const live = stats.fps > 0;

    return (
        <div className="remote-view" tabIndex={0} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}>

            <div className="remote-view__toolbar">
                <div className="remote-view__identity">
                    <span
                        className={`pulse-dot pulse-dot--signal ${live ? "pulse-dot--live" : ""}`}
                        style={live ? { "--pulse-duration": "1s" } : undefined}
                    />
                    <code>{deviceId}</code>
                </div>

                <div className="remote-view__hud">
                    <span>{stats.fps.toFixed(0)} fps</span>
                    <span className="remote-view__hud-sep">·</span>
                    <span>{stats.kbps.toFixed(0)} kb/s</span>
                </div>

                <button className="remote-view__disconnect" onClick={onClose}>Disconnect</button>
            </div>

            <div className="remote-view__stage">
                <canvas
                    ref={canvasRef}
                    className="remote-view__canvas"
                    onMouseMove={handleMouseMove}
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    onWheel={handleWheel}
                    onContextMenu={(e) => e.preventDefault()}
                />
                <div className="remote-view__scanline" aria-hidden="true" />
            </div>

        </div>
    );
}
