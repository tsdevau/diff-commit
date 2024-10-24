import tsEslint from "@typescript-eslint/eslint-plugin"
import tsEslintParser from "@typescript-eslint/parser"
import prettierPlugin from "eslint-plugin-prettier"
import tailwindcssPlugin from "eslint-plugin-tailwindcss"

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/backup/**",
      "**/.astro/**",
      "**/dist/**",
      "**/public/scripts/**",
      "./*.{js,cjs}",
    ],
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tsEslintParser,
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: ".",
      },
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tsEslintParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        project: "./tsconfig.json",
        tsconfigRootDir: ".",
      },
    },
    plugins: {
      "@typescript-eslint": tsEslint,
      prettier: prettierPlugin,
      tailwindcss: tailwindcssPlugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-extra-boolean-cast": "off",
    },
    settings: {
      tailwindcss: {
        config: "tailwind.config.mjs",
        format: "auto",
        callees: ["css", "ctl", "tw"],
        cssFiles: ["**/*.css", "!**/node_modules", "!**/.*", "!**/dist", "!**/build", "!**/.astro"],
        removeDuplicates: true,
        skipClassAttribute: false,
      },
    },
  },
]
