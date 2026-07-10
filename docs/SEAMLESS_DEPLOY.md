# Seamless day-to-day deployment (your own machine, via Tailscale)

This is the "set it up once, forget about it" flow — no more juggling 3
terminal windows every time you want to use Brio.

## What changed to make this possible

- **Server now serves the dashboard directly.** `apps/server/src/index.js`
  serves the dashboard's production build (`apps/dashboard/dist`) as
  static files on the same port as the API/WebSocket. One process, one
  port, one URL — instead of running the Vite dev server separately.
- **Dashboard auto-detects its own server.** If `VITE_WS_URL` isn't set,
  it connects to whatever host/port it was itself loaded from. So
  `http://100.84.122.109:3000` just works — no `.env` needed.
- **Both agent and server can now auto-start** via launchd (macOS),
  surviving reboots and restarting themselves if they crash.

## One-time setup

```bash
cd apps/server/deploy/macos
./install-macos.sh your-long-random-token
```

This builds the dashboard, installs server dependencies, and registers
the server as a background launchd service with your token baked in.
It'll print the Tailscale URL to use.

Then, separately, install the agent the same way (already covered in
`docs/DEPLOY_CLIENT.md`):
```bash
cd apps/agent
./build.sh
cd deploy/macos
./install-macos.sh ../../dist/brio-agent-darwin-arm64
```

## Daily use

Nothing to run. Both services start automatically on login/boot. From
any device on your tailnet (phone, another laptop):

```
http://100.84.122.109:3000
```

(replace with your own `tailscale ip -4` output)

Log in with your token, done.

## When you change code

**Dashboard changes**: rebuild and restart the server so it picks up the
new static files.
```bash
cd apps/dashboard && npm run build
launchctl unload ~/Library/LaunchAgents/com.wiramodepohon.brio-server.plist
launchctl load ~/Library/LaunchAgents/com.wiramodepohon.brio-server.plist
```

**Server changes**: just restart it (same unload/load as above) — no
rebuild step, it's plain Node.

**Agent changes**: rebuild the binary and reinstall.
```bash
cd apps/agent && ./build.sh
cd deploy/macos && ./install-macos.sh ../../dist/brio-agent-darwin-arm64
```

## Uninstalling either service

```bash
launchctl unload ~/Library/LaunchAgents/com.wiramodepohon.brio-server.plist
rm ~/Library/LaunchAgents/com.wiramodepohon.brio-server.plist

launchctl unload ~/Library/LaunchAgents/com.wiramodepohon.brio-agent.plist
rm ~/Library/LaunchAgents/com.wiramodepohon.brio-agent.plist
```
