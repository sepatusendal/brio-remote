# Deploying to a client's laptop

This covers getting the **agent** running on someone else's machine (a
client you're remotely supporting), separate from your own dev/testing
setup.

## ⚠️ Get consent first

Brio gives whoever's on the operator dashboard full screen view, mouse/
keyboard control, terminal access, and file access to the machine the
agent runs on. Only install it on a device with the owner's clear
knowledge — ideally have them run the install step themselves, or watch
you do it. Installing remote-access software on someone's computer
without their knowledge is a real legal problem in most places, not just
bad practice.

## Architecture recap

```
[Client's laptop]                [Wherever the server runs]         [Your laptop]
   brio-agent    <---- WS ---->      brio-server        <---- WS ---->   dashboard
   (background)                    (relay + auth)                    (your browser)
```

The agent needs to be able to reach the server. The dashboard (your
browser) also needs to reach the server. Easiest way to satisfy both
without exposing anything to the public internet: put the server on
**your** machine (or wherever's convenient) and have the client's laptop
join your **Tailscale** network (see `docs/TAILSCALE.md` first).

## Step 1 — Get the agent binary for the client's OS

**If the client is also on macOS** (same architecture as your dev
machine, e.g. Apple Silicon):
```bash
cd apps/agent
./build.sh
# produces dist/brio-agent-darwin-arm64
```

**If the client is on Windows, Linux, or a different Mac architecture**
(Intel vs Apple Silicon): don't cross-compile — it's unreliable because
of cgo (robotgo needs a real C toolchain for the target OS). Instead use
the GitHub Actions workflow:

1. Push this repo to GitHub (or push just a tag)
2. Actions tab → "Build agent binaries" → Run workflow
3. Optionally fill in `server_url` (your Tailscale IP, e.g.
   `ws://100.101.102.103:3000`) so the binary needs zero config on the
   client's end
4. Download the artifact for their OS from the finished run

## Step 2 — Get the client on your Tailscale network

They install Tailscale ([tailscale.com](https://tailscale.com), free)
and log into an account you control or invite them to (Tailscale
supports inviting other people's devices into your tailnet, or just use
a shared account for a personal client). Once connected, their laptop
can reach your server's Tailscale IP directly — no port forwarding, no
public exposure.

## Step 3 — Install the agent on their machine

**macOS** (auto-starts on login, restarts if it crashes):
```bash
cd apps/agent/deploy/macos
./install-macos.sh /path/to/brio-agent-darwin-arm64
```
First run will prompt for **Screen Recording** and **Accessibility**
permissions (System Settings → Privacy & Security) — they need to
approve both, then you restart the service once (the installer prints
the exact command).

**Windows** (auto-starts at logon via Task Scheduler, restarts on crash):
```powershell
cd apps/agent/deploy/windows
.\install-windows.ps1 -BinaryPath "C:\path\to\brio-agent-windows-amd64.exe"
```

⚠️ **Windows Defender will likely flag this binary.** This isn't really
about the file being unsigned — it's that screen capture + keyboard/mouse
injection + remote shell + file access is *exactly* what a remote-access
trojan looks like behaviorally, so both SmartScreen (reputation warning)
and real-time Defender (can actually quarantine the file) are primed to
be suspicious of it. Two separate problems, two fixes:

1. **SmartScreen warning on first run** — client clicks "More info" →
   "Run anyway". One-time, doesn't need admin.

2. **Defender quarantining/deleting the file** (more disruptive) — add
   an exclusion so Defender leaves it alone:
   `Windows Security → Virus & threat protection → Manage settings →
   Add or remove exclusions → Add an exclusion → File` → select
   `brio-agent.exe`. Do this *before* running the installer, or Defender
   may delete the binary before the Scheduled Task ever gets to run it.

3. **If you're distributing this to real clients regularly**, the actual
   fix is a code-signing certificate (~$70–400/year depending on vendor;
   EV certificates get SmartScreen reputation almost immediately, cheaper
   standard certs build it up over time). This is what commercial tools
   like AnyDesk/TeamViewer do — it's a real cost of doing this
   professionally, not optional polish.

**Linux** (auto-starts at login via `systemd --user`, restarts on crash):
```bash
cd apps/agent/deploy/linux
./install-linux.sh /path/to/brio-agent-linux-amd64
```
Screen capture needs an active graphical session (X11/Xwayland) — if the
target's `DISPLAY` isn't `:0`, the script tells you exactly which file to
edit. The install script also tries to enable "lingering" (needs sudo)
so the background service can start even before login, though the
screen-capture parts still need someone actually logged in graphically.

## Step 4 — Verify

Open your dashboard, the client's device should show up online. Connect
and confirm you can see their screen.

## Notes on the baked-in server URL

If you built with `BRIO_SERVER_URL` set (via `build.sh` env var or the
GitHub Actions `server_url` input), the client's binary already knows
where to connect — they don't need to configure anything. If you didn't
bake it in, you'll need to set the `BRIO_SERVER_URL` environment variable
before running it, which isn't realistic for a non-technical client — so
for real client deployments, always bake in the URL at build time.
