import { useNow } from "../hooks/useNow";

function relativeTime(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 2) return "just now";
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ago`;
}

// Maps how long ago the last heartbeat arrived to a signal state. The pulse
// animation duration below is driven by this, so a fresher heartbeat
// literally pulses faster — the motion is the telemetry, not decoration.
function signalState(ageMs, online) {
    if (!online) return { tone: "alert", label: "OFFLINE", duration: null };
    if (ageMs < 6000) return { tone: "signal", label: "LIVE", duration: "1.1s" };
    if (ageMs < 12000) return { tone: "signal", label: "LIVE", duration: "2.2s" };
    return { tone: "caution", label: "STALE", duration: "3.2s" };
}

export default function DeviceCard({ device, onConnect }) {

    const now = useNow();
    const age = now - (device.lastSeen || 0);
    const { tone, label, duration } = signalState(age, device.online);

    const disabled = !device.online || device.inSession;

    return (
        <div className={`device-card device-card--${tone}`}>

            <div className="device-card__top">
                <span
                    className={`pulse-dot pulse-dot--${tone} ${duration ? "pulse-dot--live" : ""}`}
                    style={duration ? { "--pulse-duration": duration } : undefined}
                />
                <span className={`device-card__tag device-card__tag--${tone}`}>
                    {device.inSession ? "IN SESSION" : label}
                </span>
            </div>

            <h3 className="device-card__name">{device.hostname || "unknown-host"}</h3>

            <p className="device-card__id">{device.deviceId}</p>

            <div className="device-card__meta">
                <span>{device.os || "?"} · {device.arch || "?"}</span>
                <span>{device.online ? relativeTime(age) : "disconnected"}</span>
            </div>

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
