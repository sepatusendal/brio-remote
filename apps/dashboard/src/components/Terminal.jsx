import { useEffect, useRef, useState } from "react";

export default function Terminal({ execLines, execRunning, execCommand }) {

    const [input, setInput] = useState("");
    const [history, setHistory] = useState([]);
    const historyIndexRef = useRef(-1);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [execLines]);

    function handleSubmit(e) {
        e.preventDefault();
        const command = input.trim();
        if (!command || execRunning) return;

        execCommand(command);
        setHistory((prev) => [...prev, command]);
        historyIndexRef.current = -1;
        setInput("");
    }

    function handleKeyDown(e) {
        if (e.key === "ArrowUp") {
            e.preventDefault();
            if (history.length === 0) return;
            const nextIndex = historyIndexRef.current < 0
                ? history.length - 1
                : Math.max(0, historyIndexRef.current - 1);
            historyIndexRef.current = nextIndex;
            setInput(history[nextIndex]);
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            if (historyIndexRef.current < 0) return;
            const nextIndex = historyIndexRef.current + 1;
            if (nextIndex >= history.length) {
                historyIndexRef.current = -1;
                setInput("");
            } else {
                historyIndexRef.current = nextIndex;
                setInput(history[nextIndex]);
            }
        }
    }

    return (
        <div className="terminal" onClick={() => inputRef.current?.focus()}>

            <div className="terminal__output" ref={scrollRef}>
                {execLines.length === 0 && (
                    <p className="terminal__hint">
                        Persistent shell — cd and env vars carry over between commands.
                        Avoid interactive programs (vim, top, ssh without -T): there's no
                        pty yet, so they'll hang the session.
                    </p>
                )}

                {execLines.map((line) => (
                    <div key={line.id} className={`terminal__line terminal__line--${line.kind}`}>
                        {line.kind === "command" && <span className="terminal__prompt">$ </span>}
                        <span>{line.text}</span>
                    </div>
                ))}

                {execRunning && (
                    <div className="terminal__line terminal__line--running">
                        <span className="pulse-dot pulse-dot--caution pulse-dot--live" style={{ "--pulse-duration": "0.8s" }} />
                        running...
                    </div>
                )}
            </div>

            <form className="terminal__form" onSubmit={handleSubmit}>
                <span className="terminal__prompt">$</span>
                <input
                    ref={inputRef}
                    className="terminal__input"
                    type="text"
                    value={input}
                    disabled={execRunning}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={execRunning ? "waiting for command to finish..." : "type a command..."}
                    autoComplete="off"
                    spellCheck={false}
                />
            </form>

        </div>
    );
}
