import { defineConfig } from "vite";
import fs from "node:fs";

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    https: {
      key: fs.readFileSync("./localhost+1-key.pem"),
      cert: fs.readFileSync("./localhost+1.pem"),
    },
  },
});
