# Remote access via Tailscale (free, no public exposure)

This is how to reach your dashboard and control your device from outside
your home WiFi — from your phone, from work, wherever — without opening
any ports on your router and without a domain or TLS certificate.

## Why Tailscale instead of a public deploy

Brio now has full terminal access, file manager, and process kill —
that's real remote code execution. Putting that on the public internet
(port forwarding + a domain) means anyone who finds the address can try
to brute-force or leak your access token. Tailscale sidesteps that
entirely: your server never touches the public internet. It only becomes
reachable to devices *you've* explicitly added to your own private
network (called a "tailnet"). Traffic between them is encrypted
end-to-end by WireGuard, so there's no separate TLS/Caddy/domain setup
needed either.

## Setup (~10 minutes)

### 1. Create a free Tailscale account
Go to [tailscale.com](https://tailscale.com) and sign up (free tier covers
up to 100 devices — way more than you need here).

### 2. Install Tailscale on the machine running the server + agent
This is your Mac (Wirarajas-MacBook-Pro).

```bash
brew install tailscale
sudo tailscale up
```

This opens a browser to log in. Once connected, get this machine's
Tailscale IP:

```bash
tailscale ip -4
```

You'll get something like `100.101.102.103`. That address is now
reachable from any other device on your tailnet, from anywhere in the
world, without any port forwarding.

### 3. Install Tailscale on whatever device you want to view the dashboard from
Phone: Tailscale app from the App Store / Play Store.
Another laptop: same `brew install tailscale` (Mac) or the installer for
your OS. Log into the **same Tailscale account**.

### 4. Point the dashboard at the Tailscale IP

```bash
cd apps/dashboard
cp .env.example .env
```

Edit `.env`:
```
VITE_WS_URL=ws://100.101.102.103:3000
```
(replace with your actual `tailscale ip -4` output)

Then run the dashboard as usual:
```bash
npm run dev -- --host
```
The `--host` flag makes Vite's dev server listen on all network
interfaces, not just localhost — necessary for other tailnet devices to
reach it.

### 5. From your phone/other device, open:
```
http://100.101.102.103:5173
```
(same Tailscale IP, dashboard's port)

You should see the Brio login screen. Enter your `BRIO_TOKEN` and you're
in — from anywhere, with your server never exposed to the public internet.

## Notes

- The **agent** (the thing being controlled) doesn't need any Tailscale
  changes if it's running on the same machine as the server — it already
  talks to `ws://localhost:3000`. If you ever run the agent on a
  *different* machine than the server, point its `BRIO_SERVER_URL` at the
  server's Tailscale IP too.
- Keep `BRIO_TOKEN` set to a real value (not the auto-generated one) if
  you want it to survive server restarts:
  ```bash
  BRIO_TOKEN=your-long-random-token npm run dev
  ```
- Tailscale IPs are stable per-device (they don't change), so you only
  need to look this up once.
- For always-on access (not just while your Mac is awake with a terminal
  open), you'd eventually want the server running as a background
  service — see the "Deploy hardening" section in `NEXT.md` for that.
