import { defineConfig } from "vite";
import netlifyPlugin from "@netlify/vite-plugin";

export default defineConfig({
  plugins: [netlifyPlugin()],
  server: {
    port: 5173,
  },
});
