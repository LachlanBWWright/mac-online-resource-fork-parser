import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      // Alias fs/promises to empty module for browser compatibility
      "fs/promises": resolve(__dirname, "./src/lib/empty.ts"),
    },
  },
  base: process.env.NODE_ENV === 'production' ? '/mac-online-resource-fork-parser/' : '/',
});
