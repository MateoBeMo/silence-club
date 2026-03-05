import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/silence-club/", // <<--- change if your repo name differs
  plugins: [react()],
  build: {
    outDir: "docs",
  },
});