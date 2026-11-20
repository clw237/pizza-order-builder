import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The browser talks to /api; Vite forwards it to the order service, which runs as its own process.
const serviceUrl = process.env.SERVICE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: serviceUrl,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
