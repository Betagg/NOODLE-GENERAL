import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    host: true,
    port: 5173,
    // allow access via Tailscale IP and the *.ts.net MagicDNS / serve hostname
    allowedHosts: true,
  },
  build: {
    target: "es2020",
  },
});
