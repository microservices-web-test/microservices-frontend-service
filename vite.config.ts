/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Backend targets for LOCAL development only. In the cluster, the ingress /
// gateway routes /api/* to the auth and payment services, so these proxies are
// never used in production (the built static bundle is served by nginx).
const AUTH_TARGET = process.env.BACKEND_AUTH_URL || "http://localhost:3000";
const PAYMENT_TARGET = process.env.BACKEND_PAYMENT_URL || "http://localhost:5000";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api/auth": {
        target: AUTH_TARGET,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/auth/, ""),
      },
      "/api/payment": {
        target: PAYMENT_TARGET,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/payment/, ""),
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
