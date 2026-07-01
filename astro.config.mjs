// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

import icon from "astro-icon";

export default defineConfig({
  site: "https://seaskanon.me",
  output: "static",

  integrations: [
    mdx(),
    sitemap(),
    icon(),
  ],

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@/lib": fileURLToPath(new URL("./src/lib", import.meta.url)),
        "@/consts": fileURLToPath(new URL("./src/consts.ts", import.meta.url)),
        "@/components": fileURLToPath(new URL("./src/components", import.meta.url)),
        "@/layouts": fileURLToPath(new URL("./src/layouts", import.meta.url)),
        "@/assets": fileURLToPath(new URL("./src/assets", import.meta.url)),
        "@/icons": fileURLToPath(new URL("./src/icons", import.meta.url)),
        "@/i18n": fileURLToPath(new URL("./src/i18n", import.meta.url)),
        "@/data": fileURLToPath(new URL("./src/data", import.meta.url)),
      },
    },
  },
});