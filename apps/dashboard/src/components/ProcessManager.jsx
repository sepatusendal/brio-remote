import { useEffect, useState } from "react";

export default function ProcessManager({ processes, requestProcessList, killProcess }) {

    const [killingPid, setKillingPid] = useState(null);

    useEffect(() => {
        requestProcessList();
        const id = setInterval(requestProcessList, 4000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function handleKill(pid) {
        setKillingPid(pid);
        killProcess(pid);
        setTimeout(() => setKillingPid(null), 1500);
    }

    return (
        <div className="process-manager">

            <div className="process-manager__toolbar">
                <p className="cc-panel__hint">Top {processes.length} processes by CPU usage · refreshes every 4s</p>
                <button className="cc-action" onClick={requestProcessList}>↻ Refresh</button>
            </div>

            {processes.length === 0 ? (
                <p className="cc-panel__hint">Loading process list...</p>
            ) : (
                <table className="process-table">
                    <thead>
                        <tr>
                            <th>Process</th>
                            <th>PID</th>
                            <th>CPU</th>
                            <th>Memory</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {processes.map((p) => (
                            <tr key={p.pid}>
                                <td className="process-table__name">{p.name}</td>
                                <td className="process-table__mono">{p.pid}</td>
                                <td className="process-table__mono">{p.cpuPercent.toFixed(1)}%</td>
                                <td className="process-table__mono">{p.memMB.toFixed(0)} MB</td>
                                <td>
                                    <button
                                        className="process-table__kill"
                                        disabled={killingPid === p.pid}
                                        onClick={() => handleKill(p.pid)}
                                    >
                                        {killingPid === p.pid ? "Killing..." : "Kill"}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

        </div>
    );
}
