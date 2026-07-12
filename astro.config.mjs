// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

import icon from "astro-icon";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeComponents from "rehype-components";
import remarkDirective from "remark-directive";
import { AdmonitionComponent } from "./src/plugins/rehype-component-admonition.mjs";
import { parseDirectiveNode } from "./src/plugins/remark-directive-rehype.js";
import { remarkObsidianAdmonitions, remarkFixDisplayMath } from "./src/plugins/remark-obsidian-admonitions.mjs";

// remark plugin to support Obsidian-style image sizing:
// ![alt|400](url)        -> <img src="url" alt="alt" width="400">
// ![alt|400x300](url)    -> <img src="url" alt="alt" width="400" height="300">
function remarkObsidianImageSize() {
  const SIZE_RE = /\|(\d+)(?:x(\d+))?$/;

  function walk(node, fn) {
    fn(node);
    if (node.children) {
      for (const child of node.children) {
        walk(child, fn);
      }
    }
  }

  function findParent(tree, target) {
    if (!tree.children) return null;
    for (let i = 0; i < tree.children.length; i++) {
      if (tree.children[i] === target) return { parent: tree, index: i };
      const found = findParent(tree.children[i], target);
      if (found) return found;
    }
    return null;
  }

  function escapeAttr(value) {
    return value.replace(/"/g, "&quot;");
  }

  return (tree) => {
    const imageNodes = [];
    walk(tree, (node) => {
      if (node.type === "image" && node.alt && SIZE_RE.test(node.alt)) {
        imageNodes.push(node);
      }
    });

    for (const node of imageNodes) {
      const result = findParent(tree, node);
      if (!result) continue;
      const { parent, index } = result;

      const match = node.alt.match(SIZE_RE);
      const cleanAlt = node.alt.slice(0, match.index);
      const width = match[1];
      const height = match[2];

      let html = `<img src="${escapeAttr(node.url)}" alt="${escapeAttr(cleanAlt)}" width="${width}"`;
      if (height) html += ` height="${height}"`;
      html += " />";

      parent.children.splice(index, 1, { type: "html", value: html });
    }
  };
}

// remark plugin to support Obsidian-style embedded images:
// ![[Pasted image 20260528164459.png]]
// The image filename is searched under src/content/blog (recursively), and the
// wikilink is rewritten to a relative Markdown image so Astro:assets can
// optimise it. Optional captions / sizes are preserved:
//   ![[file.png|400]]      -> width 400
//   ![[file.png|400x300]]  -> width 400, height 300
//   ![[file.png|caption]]  -> alt text
function remarkObsidianWikilinkImages(blogRoot = "./src/content/blog") {
  const blogRootAbs = path.resolve(blogRoot);

  // Build a filename -> absolute path map once per process.
  const imageMap = new Map();
  function scanDir(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(entry.name)) {
        if (!imageMap.has(entry.name)) {
          imageMap.set(entry.name, fullPath);
        }
      }
    }
  }
  scanDir(blogRootAbs);

  const WIKILINK_RE = /!\[\[([^|\]\n]+?)(?:\|([^\]\n]*?))?\]\]/g;

  function findParent(tree, target) {
    if (!tree.children) return null;
    for (let i = 0; i < tree.children.length; i++) {
      if (tree.children[i] === target) return { parent: tree, index: i };
      const found = findParent(tree.children[i], target);
      if (found) return found;
    }
    return null;
  }

  function makeImageNode(filename, pipeValue, fileDir) {
    const imageAbsPath = imageMap.get(filename);
    if (!imageAbsPath) return null;

    const relativePath = path
      .relative(fileDir, imageAbsPath)
      .replace(/\\/g, "/");
    const encodedPath = encodeURI(relativePath);

    // Treat pure numbers / NxM as Obsidian-style size, otherwise as alt.
    const SIZE_RE = /^(\d+)(?:x(\d+))?$/;
    let alt;
    if (SIZE_RE.test(pipeValue)) {
      alt = `${filename}|${pipeValue}`;
    } else {
      alt = pipeValue || filename;
    }

    return { type: "image", url: encodedPath, alt, title: null };
  }

  function resolveWikilinkText(text) {
    if (typeof text !== "string") return [];
    WIKILINK_RE.lastIndex = 0;
    const matches = [...text.matchAll(WIKILINK_RE)];
    return matches.map((m) => ({
      filename: m[1].trim(),
      pipeValue: m[2] ? m[2].trim() : "",
      match: m,
    }));
  }

  return (tree, file) => {
    const filePath = file.path || file.filename;
    if (!filePath) return;
    const fileDir = path.dirname(filePath);

    // ── Walk tree exhaustively and find every node that has a string
    //     property containing ![[…]].  Then replace the wikilink inside that
    //     property with a proper image node.  This handles text, image,
    //     imageReference, linkReference, html, and any other edge case.
    const targets = [];
    function collect(node, parent, idx) {
      for (const key of Object.keys(node)) {
        if (key === "children" || key === "type" || key === "position") continue;
        const val = node[key];
        if (typeof val === "string" && val.includes("![[")) {
          targets.push({ node, parent, index: idx, prop: key });
        }
      }
      if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
          collect(node.children[i], node, i);
        }
      }
    }
    collect(tree, null, -1);

    for (const { node, parent, index, prop } of targets) {
      if (index < 0 || !parent) continue;

      WIKILINK_RE.lastIndex = 0;
      const matches = [...node[prop].matchAll(WIKILINK_RE)];
      if (matches.length === 0) continue;

      // For text nodes we split the node into text + image + text + …
      if (node.type === "text") {
        const newNodes = [];
        let cursor = 0;
        for (const m of matches) {
          if (m.index > cursor) {
            newNodes.push({
              type: "text",
              value: node.value.slice(cursor, m.index),
            });
          }
          const img = makeImageNode(
            m[1].trim(),
            m[2] ? m[2].trim() : "",
            fileDir,
          );
          newNodes.push(img ?? { type: "text", value: m[0] });
          cursor = m.index + m[0].length;
        }
        if (cursor < node.value.length) {
          newNodes.push({ type: "text", value: node.value.slice(cursor) });
        }
        parent.children.splice(index, 1, ...newNodes);
      } else {
        // For any other node type replace the whole node with an image.
        const m = matches[0];
        const img = makeImageNode(
          m[1].trim(),
          m[2] ? m[2].trim() : "",
          fileDir,
        );
        if (img) {
          if (node.alt && typeof node.alt === "string") img.alt = node.alt;
          parent.children.splice(index, 1, img);
        }
      }
    }
  };
}

// remark plugin to support ==highlight== syntax (Obsidian / markdown-it-mark compat)
// Transforms ==text== into <mark>text</mark> inline elements
function remarkMark() {
  const MARK_RE = /==(.+?)==/g;

  function walk(node, fn) {
    fn(node);
    if (node.children) {
      for (const child of node.children) {
        walk(child, fn);
      }
    }
  }

  return (tree) => {
    const textNodes = [];
    walk(tree, (node) => {
      if (node.type === "text" && MARK_RE.test(node.value)) {
        textNodes.push(node);
      }
    });

    for (const node of textNodes) {
      function findParent(tree, target) {
        if (!tree.children) return null;
        for (let i = 0; i < tree.children.length; i++) {
          if (tree.children[i] === target) return { parent: tree, index: i };
          const found = findParent(tree.children[i], target);
          if (found) return found;
        }
        return null;
      }

      const result = findParent(tree, node);
      if (!result) continue;

      const { parent, index } = result;
      const matches = [...node.value.matchAll(MARK_RE)];
      const newNodes = [];
      let lastIndex = 0;

      for (const match of matches) {
        if (match.index > lastIndex) {
          newNodes.push({ type: "text", value: node.value.slice(lastIndex, match.index) });
        }
        newNodes.push({
          type: "html",
          value: `<mark>${match[1]}</mark>`,
        });
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < node.value.length) {
        newNodes.push({ type: "text", value: node.value.slice(lastIndex) });
      }

      parent.children.splice(index, 1, ...newNodes);
    }
  };
}

export default defineConfig({
  site: "https://seaskanon.me",
  output: "static",

  integrations: [
    mdx(),
    sitemap(),
    icon(),
  ],

  markdown: {
    remarkPlugins: [
      remarkObsidianWikilinkImages,
      remarkMath,
      remarkFixDisplayMath,
      remarkObsidianAdmonitions,
      remarkDirective,
      remarkObsidianImageSize,
      remarkMark,
      parseDirectiveNode,
    ],
    rehypePlugins: [
      [rehypeKatex, { throwOnError: false, strict: false }],
      [
        rehypeComponents,
        {
          components: {
            note: (x, y) => AdmonitionComponent(x, y, "note"),
            tip: (x, y) => AdmonitionComponent(x, y, "tip"),
            important: (x, y) => AdmonitionComponent(x, y, "important"),
            caution: (x, y) => AdmonitionComponent(x, y, "caution"),
            warning: (x, y) => AdmonitionComponent(x, y, "warning"),
            question: (x, y) => AdmonitionComponent(x, y, "question"),
          },
        },
      ],
    ],
  },

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
