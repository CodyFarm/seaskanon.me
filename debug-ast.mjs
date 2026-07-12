import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// Use the pnpm-resolved packages via require
const { unified } = require("unified");
const remarkParse = require("remark-parse");
const fs = require("node:fs");

const source = fs.readFileSync("src/content/blog/casual inference/因果性导论.md", "utf-8");
const tree = unified().use(remarkParse).parse(source);

function walk(node, depth = 0) {
  const indent = "  ".repeat(depth);
  const extra = [];
  if (node.type === "text") {
    extra.push(JSON.stringify(node.value));
  } else if (["image", "imageReference", "linkReference"].includes(node.type)) {
    extra.push(`alt=${JSON.stringify(node.alt)}`);
    extra.push(`url=${JSON.stringify(node.url)}`);
    extra.push(`identifier=${JSON.stringify(node.identifier)}`);
    extra.push(`referenceType=${JSON.stringify(node.referenceType)}`);
  }
  console.log(`${indent}${node.type}${extra.length ? " " + extra.join(" ") : ""}`);
  if (node.children) {
    for (const child of node.children) walk(child, depth + 1);
  }
}

walk(tree);
