import { copyFileSync } from "node:fs"
import { resolve } from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vitest/config"

function spaFallback(): Plugin {
  return {
    name: "spa-fallback",
    apply: "build",
    closeBundle() {
      const dist = resolve("dist")
      copyFileSync(resolve(dist, "index.html"), resolve(dist, "404.html"))
    },
  }
}

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/vozear/" : "/",
  plugins: [react(), spaFallback()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
