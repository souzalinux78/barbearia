import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.svg"],
            manifest: {
                name: "Barbearia Premium SaaS",
                short_name: "Barbearia",
                theme_color: "#101214",
                background_color: "#101214",
                display: "standalone",
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
                    }
                ]
            }
        })
    ]
});
