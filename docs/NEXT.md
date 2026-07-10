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

## Next up — in priority order

1. **Postgres persistence**
   - Wire `database/schema.sql` up via `services/device.service.js` /
     `services/auth.service.js` (currently stubs)

2. **Deploy hardening**
   - Reverse proxy (nginx/Caddy) terminating TLS, proxying `wss://`
   - `apps/server/Dockerfile` is ready; add docker-compose with Postgres
   - Agent auto-start / installer per OS (launchd/systemd/Windows service)

3. **Terminal upgrade: real pty**
   - Swap the piped-stdin shell for `github.com/creack/pty` so interactive
     programs, colors, and screen-clearing work properly
   - Would need a terminal emulator on the frontend (xterm.js) to render
     escape sequences instead of the current plain-line renderer

4. **File transfer chunking**
   - Stream large files in chunks with a progress bar instead of
     buffering the whole thing in memory on both ends

5. **Later: WebRTC migration for the video path**
   - Only worth it once relay bandwidth/latency is an actual bottleneck
   - Needs a TURN server (e.g. coturn) for NAT traversal


