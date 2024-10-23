import { defineConfig } from "vitest/dist/config.js"

// Use ESM build of Vitest for testing while keeping the extension as CJS
export default defineConfig({
  test: {
    setupFiles: ["./test/setup.ts"],
    environment: "node",
    typecheck: {
      tsconfig: "./tsconfig.vitest.json",
    },
    deps: {
      optimizer: {
        ssr: {
          exclude: ["punycode"],
        },
      },
    },
  },
  resolve: {
    // Ensure ESM versions are used for Vite/Vitest
    conditions: ["import", "node"],
    alias: [
      {
        find: "vscode",
        replacement: "./node_modules/@types/vscode/index.d.ts",
      },
    ],
  },
})
