import { useState } from "react";

export default function AccessGate({ onSubmit, error }) {

    const [value, setValue] = useState("");

    function handleSubmit(e) {
        e.preventDefault();
        if (value.trim()) onSubmit(value.trim());
    }

    return (
        <div className="access-gate">
            <form className="access-gate__card" onSubmit={handleSubmit}>
                <span className="console-bar__mark">◆</span>
                <h1>BRIO</h1>
                <p className="access-gate__hint">
                    Enter the operator access token printed in the server's terminal on startup.
                </p>

                <input
                    className="search access-gate__input"
                    type="text"
                    autoFocus
                    placeholder="Access token"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                />

                {error && <p className="access-gate__error">{error}</p>}

                <button className="device-card__connect" type="submit">Unlock console →</button>
            </form>
        </div>
    );
}
