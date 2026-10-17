import { defineConfig } from "vitest/config"

export default defineConfig({
  root: __dirname,
  // This package has no CSS; disabling the postcss step also stops Vite
  // from walking up into the parent monorepo's postcss.config.mjs (meant
  // for the Next.js app, not this package) and crashing on it.
  css: { postcss: { plugins: [] } },
  test: {
    include: ["test/**/*.test.ts"],
  },
})
