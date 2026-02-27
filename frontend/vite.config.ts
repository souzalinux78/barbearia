import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  build: {
    target: "es2021",
    sourcemap: false
  },
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "pwa-192.svg", "pwa-512.svg", "offline.html"],
      devOptions: {
        enabled: true,
        type: "module"
      },
      manifest: {
        name: "Barbearia Premium SaaS",
        short_name: "Barbearia",
        description: "Gestao inteligente para barbearias premium com experiencia nativa.",
        theme_color: "#101214",
        background_color: "#1E232A",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "pwa-192.svg",
            sizes: "192x192",
            type: "image/svg+xml"
          },
          {
            src: "pwa-512.svg",
            sizes: "512x512",
            type: "image/svg+xml"
          },
          {
            src: "pwa-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable any"
          }
        ]
      }
    })
  ]
});
