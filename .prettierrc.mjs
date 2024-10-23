/** @type {import("prettier").Config} */
const config = {
  plugins: ["prettier-plugin-packagejson", "prettier-plugin-tailwindcss"],
  printWidth: 120,
  semi: false,
  singleAttributePerLine: true,
};

export default config;
