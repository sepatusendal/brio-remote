# Deploying to a client's laptop

Short version, once you've pushed to GitHub and set up Tailscale:

```bash
cd scripts
./build-remote.sh windows ws://100.84.122.109:3000   # your Tailscale IP
```

Send the resulting `BrioAgentSetup.exe` to the client — they double-click
it, click through the wizard, done. Details and the "why" below.

## ⚠️ Get consent first

Brio gives whoever's on the operator dashboard full screen view, mouse/
keyboard control, terminal access, and file access to the machine the
agent runs on. Only install it on a device with the owner's clear
knowledge — ideally have them run the install step themselves, or watch
you do it. Installing remote-access software on someone's computer
without their knowledge is a real legal problem in most places, not just
bad practice.

## One-time setup (per repo, not per client)

1. Push this repo to GitHub if you haven't:
   ```bash
   cd brio-remote
   git init && git add . && git commit -m "brio remote"
   gh repo create brio-remote --private --source=. --push
   ```
2. Install the GitHub CLI if you don't have it: `brew install gh`, then
   `gh auth login` once.
3. Both you and the client are on the same Tailscale network (see
   `docs/TAILSCALE.md`).

## Per-client deployment (the actual fast path)

**1. Build + download** (from your machine, no browser needed):
```bash
cd scripts
./build-remote.sh windows ws://100.84.122.109:3000
./build-remote.sh linux   ws://100.84.122.109:3000
./build-remote.sh macos   ws://100.84.122.109:3000
```
Replace the IP with your own `tailscale ip -4`. Binary lands in
`downloaded/`. This bakes the server URL in — the client's binary needs
zero config.

**2. Send the installer to the client:**

- **Windows**: `build-remote.sh windows` now also produces
  `downloaded/BrioAgentSetup.exe` — a real installer with a GUI wizard
  (Next → Next → Install → Finish). Send *that* instead of the raw
  binary; the client just double-clicks it, no PowerShell needed. It
  still needs to run elevated (installer prompts for admin automatically)
  so the Defender exclusion step can happen without any manual digging
  through Windows Security.
  ⚠️ SmartScreen may still show a one-time "unrecognized app" warning —
  client clicks **More info → Run anyway**. A code-signing certificate
  (~$70–400/yr) removes this; same thing AnyDesk/TeamViewer pay for.

- **macOS**: send the binary *and* the whole `apps/agent/deploy/macos/`
  folder together (needs `install-macos.sh`, the `.plist`, and
  `Install Brio Agent.command` all in the same folder). Client
  double-clicks **`Install Brio Agent.command`** — it finds the binary
  automatically and runs the installer, no Terminal typing needed.
  ⚠️ Gatekeeper will likely block the first double-click ("cannot be
  opened because it is from an unidentified developer") since it's
  unsigned — client right-clicks the file → **Open** instead of double-
  clicking, which shows an "Open anyway" option double-click doesn't.

- **Linux**: send the binary + `install-linux.sh`, no GUI wrapper yet —
  client runs `./install-linux.sh ./brio-agent-linux-amd64` in a
  terminal. Flag it if this needs the same double-click treatment.

**3. Client runs the installer** (details above — for Windows/macOS this
is now genuinely one double-click, not a terminal command). On macOS,
first run also prompts for **Screen Recording** and **Accessibility**
permissions (System Settings → Privacy & Security) — the client needs to
approve both, then the agent needs a restart to pick them up:
```bash
launchctl unload ~/Library/LaunchAgents/com.wiramodepohon.brio-agent.plist
launchctl load ~/Library/LaunchAgents/com.wiramodepohon.brio-agent.plist
```

**4. Verify** — their device shows up on your dashboard within ~5
seconds (heartbeat interval). Connect and confirm you see their screen.

## Why not just cross-compile from your Mac?

The agent uses cgo (`robotgo`, for mouse/keyboard control), and cgo
cross-compilation is unreliable — you'd need a matching C toolchain for
the target OS. `build-remote.sh` sidesteps this entirely by building on
GitHub's own native Windows/Linux/macOS runners.
