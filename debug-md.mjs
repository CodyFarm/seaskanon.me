import fs from "node:fs";
import { unified } from "unified";
import remarkParse from "remark-parse";

const source = fs.readFileSync("src/content/blog/casual inference/因果性导论.md", "utf-8");
const tree = unified().use(remarkParse).parse(source);

function walk(node, depth = 0) {
  const indent = "  ".repeat(depth);
  if (node.type === "text") {
    console.log(`${indent}text: ${JSON.stringify(node.value.slice(0, 80))}`);
  } else {
    console.log(`${indent}${node.type}${node.alt ? ` alt=${JSON.stringify(node.alt)}` : ""}${node.url ? ` url=${JSON.stringify(node.url)}` : ""}`);
    if (node.children) {
      for (const child of node.children) walk(child, depth + 1);
    }
  }
}

walk(tree);
