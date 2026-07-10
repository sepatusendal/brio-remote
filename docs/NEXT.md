# Roadmap

## Just shipped (Milestone 3)
- Session-based screen streaming (server relay, JPEG-over-WebSocket)
- Mouse + keyboard remote control
- Realtime device list (WS push, replaced REST polling)

## Next up — in priority order

1. **Auth & pairing (critical, do this before any real deployment)**
   - JWT auth on the dashboard (login → token → attach to WS handshake)
   - Device pairing code / one-time approval instead of "anyone who
     knows the deviceId can connect"
   - Per-user device ownership, enforced server-side on CONNECT_REQUEST

2. **Postgres persistence**
   - Wire `database/schema.sql` up via `services/device.service.js` /
     `services/auth.service.js` (currently stubs)
   - Persist device registration + session history

3. **Deploy hardening**
   - Reverse proxy (nginx/Caddy) terminating TLS, proxying `wss://`
   - `apps/server/Dockerfile` is ready; add docker-compose with Postgres
   - Agent auto-start / installer per OS (launchd/systemd/Windows service)

4. **Quality-of-life for remote control**
   - Adaptive JPEG quality/FPS based on measured bandwidth
   - Clipboard sync
   - Multi-monitor support (currently only captures display 0)
   - File transfer channel

5. **Later: WebRTC migration for the video path**
   - Only worth it once relay bandwidth/latency is an actual bottleneck
   - Reuse the existing WS connection as the signaling channel
   - Needs a TURN server (e.g. coturn) for NAT traversal
