import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const BUILD_TIMESTAMP = Date.now();

export default defineConfig({
  plugins: [react()],
  base: "/",
  resolve: {
    alias: {
      "@config": path.resolve(__dirname, "../config"),
      "@assets": path.resolve(__dirname, "../assets"),
    },
  },
  server: {
    fs: {
      allow: [".."],
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash]-${BUILD_TIMESTAMP}.js`,
        chunkFileNames: `assets/[name]-[hash]-${BUILD_TIMESTAMP}.js`,
        assetFileNames: `assets/[name]-[hash]-${BUILD_TIMESTAMP}[extname]`,
        manualChunks: {
          three: ["three"],
          gsap: ["gsap"],
        },
      },
    },
  },
});
