import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Back local (PORT=3000 no .env do cidoa_back). Same-origin em dev = sem CORS.
      // Produção: reverse proxy (nginx) servindo /api same-origin, ou VITE_API_URL.
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
