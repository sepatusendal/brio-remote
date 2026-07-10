# Roadmap

## Just shipped
- Session-based screen streaming (server relay, JPEG-over-WebSocket)
- Mouse + keyboard remote control
- Realtime device list (WS push, replaced REST polling)
- Command Center: tabbed device workspace (Overview / Terminal / Files /
  Processes / Screen / Settings)
- Live activity log (real WS events, not decorative)
- On-demand screenshot (separate from continuous streaming)
- Operator access token (dashboard-side auth; agents stay unauthenticated
  by design — see `apps/server/src/websocket/server.js`)
- **Live system monitor** — real CPU/RAM gauges + sparkline (Overview tab)
- **Process manager** — list + kill processes (Processes tab)
- **Terminal** — persistent remote shell (Terminal tab). One shell process
  per Command Center session; `cd` and env vars carry over between
  commands, like a real terminal. Implementation uses a sentinel-echo
  trick (`internal/shell/shell.go`) to detect command completion over a
  plain stdin/stdout pipe.
  - **Known limitation**: no pty, so interactive/full-screen programs
    (vim, top, less, ssh without `-T`) will hang the session — they never
    print the completion sentinel. Worth a warning in the UI if this
    trips people up in practice.
  - This is full remote code execution, now gated behind the operator
    token from the previous milestone.

- **File manager** — browse, upload, download, delete, rename, mkdir
  (Files tab). Whole-file transfer over binary WS frames tagged `0x03`
  (download, agent→viewer) / `0x04` (upload, viewer→agent) — no chunking
  yet, so very large files (multi-GB) aren't a good fit until that's
  added. `internal/files/files.go` on the agent side.

- **Real pty terminal** — upgraded from the line-based shell to an actual
  pseudo-terminal (`github.com/creack/pty`) rendered with `xterm.js` on the
  frontend. `vim`, `htop`, `less`, colors, and full interactivity all work
  now. Raw bytes stream both ways over binary WS frames tagged `0x05`
  (agent→viewer output) / `0x06` (viewer→agent keystrokes) — no more
  sentinel-echo hack, no more command/output line parsing. Terminal
  resize is forwarded live (`TERM_RESIZE`) so full-screen programs reflow
  correctly.
  - Windows note: `creack/pty`'s ConPTY support is newer/less proven than
    its Unix support — treat Windows agents as best-effort for now.

- **Remote access via Tailscale** — documented in `docs/TAILSCALE.md`.
  Access the dashboard from outside the local WiFi (phone, another
  network) without any port forwarding, domain, or TLS setup — the
  server never touches the public internet. Vite dev server now binds to
  all interfaces by default (`server.host: true`) so it's reachable over
  the tailnet.

## Next up — in priority order

1. **Postgres persistence**
   - Wire `database/schema.sql` up via `services/device.service.js` /
     `services/auth.service.js` (currently stubs)
   - Given Terminal/File Manager access is now real RCE, an audit trail
     (who ran what command, when, from which viewer) is worth prioritizing
     alongside this — currently nothing survives a server restart

2. **Deploy hardening (only if you actually want public, non-Tailscale
   access later)**
   - Reverse proxy (Caddy) terminating TLS, proxying `wss://`
   - `apps/server/Dockerfile` is ready; add docker-compose with Postgres
   - Agent auto-start / installer per OS (launchd/systemd/Windows service)
     — useful even for the Tailscale setup, so the agent survives reboots

3. **File transfer chunking**
   - Stream large files in chunks with a progress bar instead of
     buffering the whole thing in memory on both ends

4. **Later: WebRTC migration for the video path**
   - Only worth it once relay bandwidth/latency is an actual bottleneck
   - Needs a TURN server (e.g. coturn) for NAT traversal


