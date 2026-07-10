import { useMemo, useState } from "react";
import { useBrioSocket } from "./hooks/useBrioSocket";
import DeviceCard from "./components/DeviceCard";
import RemoteView from "./components/RemoteView";
import "./App.css";

export default function App() {

    const {
        connected,
        devices,
        session,
        requestConnect,
        endSession,
        sendInput,
        onFrame,
    } = useBrioSocket();

    const [query, setQuery] = useState("");

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();

        const list = !q
            ? devices
            : devices.filter((d) =>
                (d.hostname || "").toLowerCase().includes(q) ||
                (d.deviceId || "").toLowerCase().includes(q) ||
                (d.os || "").toLowerCase().includes(q)
            );

        // Online devices first, most recently seen first.
        return [...list].sort((a, b) => {
            if (a.online !== b.online) return a.online ? -1 : 1;
            return (b.lastSeen || 0) - (a.lastSeen || 0);
        });
    }, [devices, query]);

    const onlineCount = devices.filter((d) => d.online).length;

    if (session?.status === "active") {
        return (
            <div className="view-transition">
                <RemoteView
                    deviceId={session.deviceId}
                    sendInput={sendInput}
                    onFrame={onFrame}
                    onClose={endSession}
                />
            </div>
        );
    }

    return (
        <div className="view-transition">
            <div className="console">

                <header className="console-bar">
                    <div className="console-bar__brand">
                        <span className="console-bar__mark">◆</span>
                        <div>
                            <h1>BRIO</h1>
                            <p className="console-bar__tagline">Remote Operator Console</p>
                        </div>
                    </div>

                    <div className="console-bar__stats">
                        <div className="stat">
                            <span className="stat__value">{onlineCount}<span className="stat__of">/{devices.length}</span></span>
                            <span className="stat__label">devices online</span>
                        </div>
                        <div className={`server-link ${connected ? "server-link--up" : "server-link--down"}`}>
                            <span className="pulse-dot pulse-dot--tiny" style={{ "--pulse-duration": connected ? "1.6s" : undefined }} />
                            {connected ? "server linked" : "server unreachable"}
                        </div>
                    </div>
                </header>

                {session?.status === "connecting" && (
                    <div className="banner banner--caution">
                        <span className="pulse-dot pulse-dot--caution pulse-dot--live" style={{ "--pulse-duration": "0.8s" }} />
                        Establishing session with <code>{session.deviceId}</code>...
                    </div>
                )}

                {session?.status === "rejected" && (
                    <div className="banner banner--alert">
                        Connection to <code>{session.deviceId}</code> refused — {session.reason}
                    </div>
                )}

                <div className="toolbar">
                    <input
                        className="search"
                        type="text"
                        placeholder="Filter by hostname, device ID, or OS..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>

                {devices.length === 0 ? (
                    <div className="empty-console">
                        <p><span className="empty-console__cursor">_</span> awaiting signal</p>
                        <p className="empty-console__hint">No agents have checked in yet. Start one on a target device to see it here.</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="empty-console">
                        <p>no matches for "{query}"</p>
                    </div>
                ) : (
                    <div className="device-grid">
                        {filtered.map((device) => (
                            <DeviceCard key={device.deviceId} device={device} onConnect={requestConnect} />
                        ))}
                    </div>
                )}

            </div>
        </div>
    );
}
