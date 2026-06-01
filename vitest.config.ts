import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
    passWithNoTests: true,
    poolOptions: {
      forks: { execArgv: ["--no-experimental-webstorage"] },
      threads: { execArgv: ["--no-experimental-webstorage"] }
    }
  }
});
