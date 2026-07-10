import { useState } from "react";
import ScreenPanel from "./ScreenPanel";
import { useNow } from "../hooks/useNow";

const TABS = [
    { id: "overview", label: "Overview", icon: "◈" },
    { id: "terminal", label: "Terminal", icon: "▸" },
    { id: "files", label: "Files", icon: "▤" },
    { id: "processes", label: "Processes", icon: "▥" },
    { id: "screen", label: "Screen", icon: "▣" },
    { id: "settings", label: "Settings", icon: "⚙" },
];

function relativeTime(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 2) return "just now";
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    return `${m}m ago`;
}

function ComingSoon({ title, blurb }) {
    return (
        <div className="coming-soon">
            <p className="coming-soon__tag">🚧 not built yet</p>
            <h3>{title}</h3>
            <p>{blurb}</p>
        </div>
    );
}

export default function CommandCenter({
    device,
    activityLog,
    screenshot,
    sendInput,
    onStreamFrame,
    startStream,
    stopStream,
    requestScreenshot,
    onClose,
}) {

    const [tab, setTab] = useState("overview");
    const now = useNow();

    return (
        <div className="command-center">

            <header className="cc-header">
                <div className="cc-header__identity">
                    <span className="cc-header__icon">💻</span>
                    <div>
                        <h2>{device?.hostname || "Unknown device"}</h2>
                        <code>{device?.deviceId}</code>
                    </div>
                </div>
                <button className="cc-header__disconnect" onClick={onClose}>Disconnect</button>
            </header>

            <nav className="cc-tabs">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        className={`cc-tab ${tab === t.id ? "cc-tab--active" : ""}`}
                        onClick={() => setTab(t.id)}
                    >
                        <span className="cc-tab__icon">{t.icon}</span>
                        {t.label}
                    </button>
                ))}
            </nav>

            <div className="cc-content">

                {tab === "overview" && (
                    <div className="cc-overview">

                        <div className="cc-panel">
                            <h3 className="cc-panel__title">Device info</h3>
                            <dl className="cc-specs">
                                <div><dt>Hostname</dt><dd>{device?.hostname || "unknown"}</dd></div>
                                <div><dt>OS</dt><dd>{device?.os || "unknown"} · {device?.arch || "?"}</dd></div>
                                <div><dt>CPU</dt><dd>{device?.cpuModel || "unknown"}</dd></div>
                                <div><dt>Device ID</dt><dd>{device?.deviceId}</dd></div>
                            </dl>
                        </div>

                        <div className="cc-panel">
                            <div className="cc-panel__row">
                                <h3 className="cc-panel__title">Screenshot</h3>
                                <button className="cc-action" onClick={requestScreenshot}>📷 Screenshot</button>
                            </div>
                            {screenshot ? (
                                <img className="cc-screenshot" src={screenshot} alt="Latest screenshot" />
                            ) : (
                                <p className="cc-panel__hint">No screenshot yet — click the button to capture one.</p>
                            )}
                        </div>

                        <div className="cc-panel cc-panel--log">
                            <h3 className="cc-panel__title">Activity log</h3>
                            {activityLog.length === 0 ? (
                                <p className="cc-panel__hint">Nothing logged yet this session.</p>
                            ) : (
                                <ul className="cc-log">
                                    {activityLog.map((entry) => (
                                        <li key={entry.id}>
                                            <span className="cc-log__time">{relativeTime(now - entry.ts)}</span>
                                            <span>{entry.label}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                    </div>
                )}

                {tab === "terminal" && (
                    <ComingSoon
                        title="Remote terminal"
                        blurb="Run pwd, ls, whoami and see output stream back in realtime. Needs a new command-execution channel on the agent — next sprint."
                    />
                )}

                {tab === "files" && (
                    <ComingSoon
                        title="File manager"
                        blurb="Browse, upload, download, rename, and delete files on the remote device."
                    />
                )}

                {tab === "processes" && (
                    <ComingSoon
                        title="Process manager"
                        blurb="See what's running on the device and kill processes remotely, task-manager style."
                    />
                )}

                {tab === "screen" && (
                    <ScreenPanel
                        sendInput={sendInput}
                        onStreamFrame={onStreamFrame}
                        startStream={startStream}
                        stopStream={stopStream}
                    />
                )}

                {tab === "settings" && (
                    <ComingSoon
                        title="Settings"
                        blurb="Agent auto-start, stream quality defaults, and pairing/auth controls will live here."
                    />
                )}

            </div>

        </div>
    );
}
