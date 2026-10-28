import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": { target: process.env.API_URL ?? "http://127.0.0.1:8090", changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      "/api": { target: process.env.API_URL ?? "http://127.0.0.1:8090", changeOrigin: true },
    },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
})
