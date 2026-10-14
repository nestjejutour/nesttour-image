import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { aiPlugin } from "./server/aiPlugin";

export default defineConfig({
  base: "./",
  plugins: [react(), aiPlugin()],
  server: { host: "0.0.0.0", port: 5173 },
});
