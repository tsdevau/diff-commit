import { defineConfig } from "vitest/dist/config.js"

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
    silent: true,
    exclude: ["node_modules", "test/edgeCases.test.ts"],
  },
  resolve: {
    conditions: ["import", "node"],
    alias: [
      {
        find: "vscode",
        replacement: "./node_modules/@types/vscode/index.d.ts",
      },
    ],
  },
})
