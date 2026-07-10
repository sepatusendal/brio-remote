import { useNow } from "../hooks/useNow";

function relativeTime(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 2) return "just now";
    if (s < 60) return `${s} sec ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    return `${h}h ago`;
}

function signalState(ageMs, online) {
    if (!online) return { tone: "alert", label: "OFFLINE", duration: null };
    if (ageMs < 6000) return { tone: "signal", label: "LIVE", duration: "1.1s" };
    if (ageMs < 12000) return { tone: "signal", label: "LIVE", duration: "2.2s" };
    return { tone: "caution", label: "STALE", duration: "3.2s" };
}

function osIcon(os) {
    if (!os) return "🖥️";
    if (os.includes("darwin")) return "🍎";
    if (os.includes("win")) return "🪟";
    if (os.includes("linux")) return "🐧";
    return "🖥️";
}

export default function DeviceCard({ device, onConnect }) {

    const now = useNow();
    const age = now - (device.lastSeen || 0);
    const { tone, label, duration } = signalState(age, device.online);

    const disabled = !device.online || device.inSession;

    return (
        <div className={`device-card device-card--${tone}`}>

            <div className="device-card__top">
                <span className="device-card__icon">{osIcon(device.os)}</span>
                <h3 className="device-card__name">{device.hostname || "unknown-host"}</h3>
                <span className={`device-card__badge device-card__badge--${tone}`}>
                    <span
                        className={`pulse-dot pulse-dot--${tone} ${duration ? "pulse-dot--live" : ""}`}
                        style={duration ? { "--pulse-duration": duration } : undefined}
                    />
                    {device.inSession ? "IN SESSION" : label}
                </span>
            </div>

            <div className="device-card__divider" />

            <dl className="device-card__specs">
                <div>
                    <dt>Hostname</dt>
                    <dd>{device.hostname || device.deviceId}</dd>
                </div>
                <div>
                    <dt>OS</dt>
                    <dd>{device.os || "unknown"} · {device.arch || "?"}</dd>
                </div>
                <div>
                    <dt>CPU</dt>
                    <dd>{device.cpuModel || "unknown"}</dd>
                </div>
                <div>
                    <dt>Heartbeat</dt>
                    <dd>{device.online ? relativeTime(age) : "disconnected"}</dd>
                </div>
            </dl>

            <div className="device-card__divider" />

            <button
                className="device-card__connect"
                disabled={disabled}
                onClick={() => onConnect(device.deviceId)}
            >
                {device.inSession ? "In use" : "Connect →"}
            </button>

        </div>
    );
}
