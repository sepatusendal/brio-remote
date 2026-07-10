# Brio Remote — Milestone 3: Screen Share & Remote Control

**Made by Wira Mode Pohon**

An AnyDesk-style remote access tool: a Go agent runs on the target machine,
a Node/Express + WebSocket server relays sessions, and a React dashboard
lets a viewer watch and control a connected device.

## What's in this milestone

- **Session relay protocol** over a single WebSocket connection per client
  (see `apps/server/src/websocket/server.js`): device heartbeats, viewer
  registration, connect request/accept/reject, live JPEG frame relay, and
  mouse/keyboard input relay.
- **Go agent** captures the primary display (`internal/capture`) and streams
  JPEG frames only while a viewer session is active, and injects mouse/
  keyboard input on request (`internal/control`).
- **React dashboard** shows devices in realtime (no more REST polling), and
  a canvas-based `RemoteView` renders the live stream and forwards input.

## Architecture choice: server relay, not WebRTC (yet)

Frames and input are relayed through the Node server over the existing
WebSocket connections, rather than negotiated as a WebRTC P2P stream. This
avoids needing STUN/TURN infrastructure up front and reuses the connection
that already exists for heartbeats. It's the right call for getting a
working MVP and testing on real networks; if latency/bandwidth becomes a
bottleneck, the signaling can be reused to move the video path to WebRTC
later without changing the app dependencies.

## ⚠️ Known gaps before this goes anywhere near the public internet

- **No authentication.** Any client that knows a `deviceId` can be
  targeted. There's no pairing/approval step and no login on the
  dashboard. This is the top priority for the next milestone.
- **No persistence.** `database/schema.sql` exists but nothing writes to
  Postgres yet — device state lives in memory and resets on restart.
- **No TLS termination in the app itself.** Deploy behind a reverse proxy
  (nginx/Caddy) that terminates HTTPS/WSS.

## Running locally

```bash
# Server
cd apps/server
npm install
npm run dev            # http://localhost:3000

# Dashboard
cd apps/dashboard
npm install
npm run dev            # http://localhost:5173

# Agent (on the machine you want to control)
cd apps/agent
go mod tidy             # fetches kbinani/screenshot + go-vgo/robotgo
go run main.go
```

## Remote access from outside your WiFi

See [`docs/TAILSCALE.md`](docs/TAILSCALE.md) — free, no port forwarding,
no domain, no TLS setup, and the server never touches the public
internet. This is the recommended way to reach Brio from your phone or
another network, given how much access the Terminal/File Manager tabs
grant.

See `docs/NEXT.md` for the roadmap.
