import { visit } from "unist-util-visit";

/**
 * Matches Obsidian / GitHub-style admonition declarations at the start of a
 * blockquote paragraph:
 *
 *   > [!tip] Optional title here
 *   > Content line 1
 *   > Content line 2
 *
 * The first line is removed; the optional title becomes the directive label.
 * Supports the standard GitHub form (`> [!tip]`) as well.
 */
const ADMONITION_RE = /^\s*\[!(?<type>\w+)\](?:\s+(?<title>.+))?$/;

export function remarkObsidianAdmonitions() {
	return (tree) => {
		visit(tree, "blockquote", (node, index, parent) => {
			if (!parent || index === undefined) return;

			const firstChild = node.children[0];
			if (firstChild?.type !== "paragraph") return;

			const firstText = firstChild.children[0];
			if (firstText?.type !== "text") return;

			const lines = firstText.value.split("\n");
			const match = lines[0].match(ADMONITION_RE);
			if (!match) return;

			const type = match.groups.type.toLowerCase();
			const title = match.groups.title?.trim();
			const remainingLines = lines.slice(1);

			const children = [];

			if (title) {
				children.push({
					type: "paragraph",
					data: { directiveLabel: true },
					children: [{ type: "text", value: title }],
				});
			}

			const firstParagraphChildren = [];
			if (remainingLines.length > 0) {
				firstParagraphChildren.push({
					type: "text",
					value: remainingLines.join("\n"),
				});
			}
			firstParagraphChildren.push(...firstChild.children.slice(1));

			if (firstParagraphChildren.length > 0) {
				children.push({ type: "paragraph", children: firstParagraphChildren });
			}

			children.push(...node.children.slice(1));

			parent.children[index] = {
				type: "containerDirective",
				name: type,
				children,
			};
		});
	};
}

/**
 * remark-math only recognises multi-line display math when the opening `$$`
 * is on its own line. This plugin fixes the common malformed variant:
 *
 *   $$\text{标题}
 *   equation = here
 *   $$
 *
 * by reconstructing the math node from the original source so the \text{}
 * content is preserved.
 */
const MALFORMED_DISPLAY_MATH_RE = /^\$\$\\text\{([^}]+)\}\n([\s\S]*?)\n\$\$$/m;

export function remarkFixDisplayMath() {
	return (tree, file) => {
		const source = file.value;

		visit(tree, "paragraph", (node, index, parent) => {
			if (!parent || index === undefined) return;
			if (!node.position) return;

			const hasMath = node.children.some(
				(child) => child.type === "math" || child.type === "inlineMath",
			);
			if (!hasMath) return;

			const start = node.position.start.offset;
			const end = node.position.end.offset;
			if (typeof start !== "number" || typeof end !== "number") return;

			const original = source.slice(start, end);
			const match = original.match(MALFORMED_DISPLAY_MATH_RE);
			if (!match) return;

			const textContent = match[1];
			const rest = match[2];
			const correctedValue = `\\text{${textContent}}\n${rest}`;

			parent.children[index] = {
				type: "math",
				value: correctedValue,
				position: node.position,
			};
		});
	};
}
