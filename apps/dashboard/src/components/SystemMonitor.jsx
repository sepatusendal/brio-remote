function sparklinePoints(history, key, width, height) {
    if (history.length < 2) return "";

    const step = width / (history.length - 1);

    return history
        .map((point, i) => {
            const x = i * step;
            const y = height - (Math.min(point[key], 100) / 100) * height;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
}

function tone(percent) {
    if (percent >= 85) return "alert";
    if (percent >= 60) return "caution";
    return "signal";
}

function Gauge({ label, percent, sublabel, history, historyKey }) {
    const t = tone(percent);
    const points = sparklinePoints(history, historyKey, 200, 36);

    return (
        <div className="gauge">
            <div className="gauge__head">
                <span className="gauge__label">{label}</span>
                <span className={`gauge__value gauge__value--${t}`}>{percent.toFixed(0)}%</span>
            </div>

            <div className="gauge__bar">
                <div
                    className={`gauge__bar-fill gauge__bar-fill--${t}`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                />
            </div>

            {points && (
                <svg className="gauge__spark" viewBox="0 0 200 36" preserveAspectRatio="none">
                    <polyline
                        points={points}
                        fill="none"
                        className={`gauge__spark-line gauge__spark-line--${t}`}
                    />
                </svg>
            )}

            {sublabel && <p className="gauge__sublabel">{sublabel}</p>}
        </div>
    );
}

export default function SystemMonitor({ history }) {

    if (history.length === 0) {
        return <p className="cc-panel__hint">Waiting for the first telemetry sample...</p>;
    }

    const latest = history[history.length - 1];

    return (
        <div className="system-monitor">
            <Gauge
                label="CPU"
                percent={latest.cpuPercent || 0}
                history={history}
                historyKey="cpuPercent"
            />
            <Gauge
                label="Memory"
                percent={latest.memPercent || 0}
                sublabel={`${(latest.memUsedMB / 1024).toFixed(1)} GB / ${(latest.memTotalMB / 1024).toFixed(1)} GB`}
                history={history}
                historyKey="memPercent"
            />
        </div>
    );
}
