import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

// Matches the CSS console tokens so the terminal blends into the rest of
// the operator console instead of looking like a foreign widget.
const XTERM_THEME = {
    background: "#05070a",
    foreground: "#a8b3c4",
    cursor: "#4de8d4",
    cursorAccent: "#05070a",
    selectionBackground: "rgba(156, 140, 255, 0.3)",
    black: "#12161d",
    red: "#ff6b6b",
    green: "#4de8d4",
    yellow: "#ffb454",
    blue: "#9c8cff",
    magenta: "#9c8cff",
    cyan: "#4de8d4",
    white: "#edf1f7",
    brightBlack: "#647087",
    brightRed: "#ff6b6b",
    brightGreen: "#4de8d4",
    brightYellow: "#ffb454",
    brightBlue: "#9c8cff",
    brightMagenta: "#9c8cff",
    brightCyan: "#4de8d4",
    brightWhite: "#edf1f7",
};

export default function Terminal({ onTermOutput, sendTermInput, sendTermResize }) {

    const containerRef = useRef(null);
    const xtermRef = useRef(null);
    const fitAddonRef = useRef(null);

    useEffect(() => {

        const term = new XTerm({
            fontFamily: "'IBM Plex Mono', ui-monospace, Menlo, monospace",
            fontSize: 13,
            theme: XTERM_THEME,
            cursorBlink: true,
            scrollback: 5000,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(containerRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        sendTermResize(term.cols, term.rows);

        const dataDisposable = term.onData((data) => {
            sendTermInput(new TextEncoder().encode(data).buffer);
        });

        const resizeDisposable = term.onResize(({ cols, rows }) => {
            sendTermResize(cols, rows);
        });

        onTermOutput((buffer) => {
            term.write(new Uint8Array(buffer));
        });

        function handleWindowResize() {
            fitAddon.fit();
        }
        window.addEventListener("resize", handleWindowResize);

        return () => {
            window.removeEventListener("resize", handleWindowResize);
            dataDisposable.dispose();
            resizeDisposable.dispose();
            onTermOutput(null);
            term.dispose();
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="terminal-shell">
            <p className="terminal-shell__hint">
                Real pty — colors, vim, htop, and interactive programs all work here.
            </p>
            <div className="terminal-shell__viewport" ref={containerRef} />
        </div>
    );
}
