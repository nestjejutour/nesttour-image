import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { aiPlugin } from "./server/aiPlugin";
import { copyPlugin } from "./server/copyPlugin";

export default defineConfig({
  base: "./",
  plugins: [react(), aiPlugin(), copyPlugin()],
  server: { host: "0.0.0.0", port: 5173 },
});
