import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Listen on all interfaces (not just localhost) so the dashboard is
    // reachable over Tailscale/LAN — see docs/TAILSCALE.md.
    host: true,
  },
})
