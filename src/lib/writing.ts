import { getCollection, type CollectionEntry } from "astro:content";
import { posix as path } from "node:path";

export type WritingPost = CollectionEntry<"blog">;
export type TaxonomyCount = {
  name: string;
  slug: string;
  count: number;
};

const CJK_RE = /[㐀-鿿豈-﫿]/g;
const WORD_RE = /[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g;
const CONTENT_ROOT = "/src/content";

export async function getPublishedWriting() {
  const posts = await getCollection("blog");

  return sortByPubDateDesc(posts.filter((post) => !post.data.draft));
}

export function sortByPubDateDesc(posts: WritingPost[]) {
  return [...posts].sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
}

export function getPostUrl(post: WritingPost) {
  return `/writing/${post.id}/`;
}

export function getPostCover(post: WritingPost) {
  return post.data.cover || post.data.heroImage;
}

/** Convert backslashes to forward slashes, collapse duplicate slashes,
 *  strip Windows drive letters, and extract /src/ or /public/ root from
 *  absolute paths so they match Vite glob keys. */
export function normalizeImagePath(raw: string | undefined): string | undefined {
  if (!raw) return undefined;

  let normalized = raw.replace(/\\/g, "/").trim();
  normalized = normalized.replace(/\/+/g, "/");
  normalized = normalized.replace(/^[A-Za-z]:\//, "/");

  if (
    normalized.startsWith("/") &&
    !normalized.startsWith("/src/") &&
    !normalized.startsWith("/public/")
  ) {
    const srcIdx = normalized.indexOf("/src/");
    const publicIdx = normalized.indexOf("/public/");
    const idx = srcIdx !== -1 ? srcIdx : publicIdx;
    if (idx !== -1) normalized = normalized.slice(idx);
  }

  if (normalized.startsWith("src/") || normalized.startsWith("public/")) {
    normalized = "/" + normalized;
  }

  return normalized;
}

function getPostBaseDir(post: WritingPost): string {
  if (post.filePath) {
    const normalized = post.filePath.replace(/\\/g, "/");
    const match = normalized.match(/src\/content\/blog\/(.+)\/[^/]+$/);
    if (match) return match[1];
  }
  return post.id.includes("/") ? path.dirname(post.id) : post.id;
}

/** Two resolution bases for hero/cover image paths:
 *  1. Project path   — /src/… or /public/… (resolved from project root)
 *  2. Content path   — any other path resolved from src/content/ as root
 *
 *  When post context is available, post-relative /assets/ and bare paths
 *  are resolved relative to the post's directory first, then fall back
 *  to content-root resolution. */
export function resolveHeroImagePath(
  raw: string | undefined,
  post?: WritingPost,
): string | undefined {
  let normalized = normalizeImagePath(raw);
  if (!normalized) return undefined;

  // 1. Project-root absolute paths — return as-is
  if (normalized.startsWith("/src/") || normalized.startsWith("/public/")) {
    return normalized.replace(/\/+/g, "/");
  }

  // 2. Post-relative resolution (requires post context)
  if (post) {
    const baseDir = getPostBaseDir(post);

    // /assets/foo.png -> /src/content/blog/<post-dir>/assets/foo.png
    if (normalized.startsWith("/assets/")) {
      return `/src/content/blog/${baseDir}${normalized}`.replace(/\/+/g, "/");
    }
    // bare relative path -> /src/content/blog/<post-dir>/<path>
    if (!normalized.startsWith("/")) {
      return `/src/content/blog/${baseDir}/${normalized}`.replace(/\/+/g, "/");
    }
  }

  // 3. Content-root-relative — resolve from src/content/
  //    /blog/…  → /src/content/blog/…
  //    blog/…   → /src/content/blog/…
  if (normalized.startsWith("/")) {
    return `${CONTENT_ROOT}${normalized}`.replace(/\/+/g, "/");
  }

  return `${CONTENT_ROOT}/${normalized}`.replace(/\/+/g, "/");
}

/** Convenience wrapper: get the normalized cover path for a post. */
export function getNormalizedPostCover(post: WritingPost): string | undefined {
  return resolveHeroImagePath(getPostCover(post), post);
}

export function stripHtml(value = "") {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function countWords(text = "") {
  const cjkCount = text.match(CJK_RE)?.length ?? 0;
  const withoutCjk = text.replace(CJK_RE, " ");
  const wordCount = withoutCjk.match(WORD_RE)?.length ?? 0;

  return cjkCount + wordCount;
}

export function getReadingTime(post: WritingPost) {
  const words = countWords(`${stripHtml(post.data.description)} ${post.body ?? ""}`);
  const minutes = Math.max(1, Math.ceil(words / 350));

  return {
    words,
    minutes,
    text: `${minutes} min read`,
  };
}

export function getWritingStats(posts: WritingPost[]) {
  const categories = getCategoryCounts(posts);
  const tags = getTagCounts(posts);
  const totalWords = posts.reduce((total, post) => total + getReadingTime(post).words, 0);

  return {
    totalPosts: posts.length,
    totalCategories: categories.length,
    totalTags: tags.length,
    totalWords,
  };
}

export function getCategoryCounts(posts: WritingPost[]) {
  return getTaxonomyCounts(posts.flatMap((post) => {
    const cat = post.data.category || post.data.categories;
    return cat ? [cat] : [];
  }));
}

export function getTagCounts(posts: WritingPost[]) {
  return getTaxonomyCounts(posts.flatMap((post) => post.data.tags));
}

export function getSeriesCounts(posts: WritingPost[]) {
  return getTaxonomyCounts(posts.flatMap((post) => post.data.series ? [post.data.series] : []));
}

/** Return all posts in the same series, ordered by series_id ascending. */
export function getSeriesPosts(allPosts: WritingPost[], seriesName: string): WritingPost[] {
  return allPosts
    .filter((p) => p.data.series === seriesName)
    .sort((a, b) => {
      const aId = parseInt(a.data.series_id ?? "0", 10);
      const bId = parseInt(b.data.series_id ?? "0", 10);
      return aId - bId;
    });
}

export function getTaxonomyCounts(values: string[]) {
  const counts = new Map<string, TaxonomyCount>();

  for (const value of values) {
    const name = normalizeTaxonomy(value);
    if (!name) continue;

    const slug = slugifyTaxonomy(name);
    const current = counts.get(slug);
    counts.set(slug, {
      name: current?.name ?? name,
      slug,
      count: (current?.count ?? 0) + 1,
    });
  }

  return [...counts.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name);
  });
}

export function normalizeTaxonomy(value = "") {
  return value.trim().replace(/\s+/g, " ");
}

export function slugifyTaxonomy(value = "") {
  return normalizeTaxonomy(value)
    .toLocaleLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[\\/]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function matchesTaxonomySlug(value: string | undefined, slug: string) {
  if (!value) return false;
  return slugifyTaxonomy(value) === slug;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

// ── First-letter colour ────────────────────────────────────────────────

const PRESET_COLORS: Record<string, { hex: string; twClass: string }> = {
  // Original curated palette
  pink:      { hex: "#F396E5", twClass: "text-ppink" },
  blue:      { hex: "#96C7F2", twClass: "text-pblue" },
  green:     { hex: "#ADF296", twClass: "text-pgreen" },
  yellow:    { hex: "#F2CF96", twClass: "text-pyellow" },
  purple:    { hex: "#9D859A", twClass: "text-ppurlple" },
  gold:      { hex: "#D4A574", twClass: "text-pgold" },

  // Warm / red family
  red:       { hex: "#E85D5D", twClass: "" },
  orange:    { hex: "#F2A96C", twClass: "" },
  coral:     { hex: "#FF7F7F", twClass: "" },
  crimson:   { hex: "#DC143C", twClass: "" },
  salmon:    { hex: "#FA8072", twClass: "" },
  tomato:    { hex: "#FF6347", twClass: "" },

  // Cool / cyan-teal family
  cyan:      { hex: "#5CE1E6", twClass: "" },
  teal:      { hex: "#008B8B", twClass: "" },
  aquamarine:{ hex: "#7FFFD4", twClass: "" },
  turquoise: { hex: "#40E0D0", twClass: "" },

  // Green / yellow-green family
  lime:      { hex: "#B8E600", twClass: "" },
  chartreuse:{ hex: "#7FFF00", twClass: "" },
  olive:     { hex: "#808000", twClass: "" },

  // Purple / violet family
  indigo:    { hex: "#4B0082", twClass: "" },
  violet:    { hex: "#8A2BE2", twClass: "" },
  magenta:   { hex: "#FF00FF", twClass: "" },
  orchid:    { hex: "#DA70D6", twClass: "" },
  plum:      { hex: "#DDA0DD", twClass: "" },
  lavender:  { hex: "#E6E6FA", twClass: "" },

  // Earthy / brown family
  khaki:     { hex: "#F0E68C", twClass: "" },
  wheat:     { hex: "#F5DEB3", twClass: "" },
  tan:       { hex: "#D2B48C", twClass: "" },
  peru:      { hex: "#CD853F", twClass: "" },
  sienna:    { hex: "#A0522D", twClass: "" },
  maroon:    { hex: "#800000", twClass: "" },
  brown:     { hex: "#A52A2A", twClass: "" },

  // Neutral / muted family
  slate:     { hex: "#708090", twClass: "" },
  charcoal:  { hex: "#36454F", twClass: "" },
};

const PRESET_ENTRIES = Object.values(PRESET_COLORS);
const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

function isValidHexColor(value: string): boolean {
  return HEX_RE.test(value);
}

export interface FirstLetterColor {
  /** Tailwind text colour class (may be empty for custom hex colours). */
  className: string;
  /** Inline CSS colour value (hex). */
  style: string;
}

/**
 * Resolve a first-letter colour from metadata.
 *
 * | Input            | Result                              |
 * |------------------|-------------------------------------|
 * | `"pink"`         | preset → Tailwind class + hex style |
 * | `"#ff6600"`      | custom hex → inline style only      |
 * | `undefined` / "" | random preset                       |
 */
export function getFirstLetterColor(color?: string): FirstLetterColor {
  // 1. Known preset name
  if (color && PRESET_COLORS[color]) {
    const preset = PRESET_COLORS[color];
    return { className: preset.twClass, style: preset.hex };
  }

  // 2. Valid hex colour → inline style, no Tailwind class
  if (color && isValidHexColor(color)) {
    return { className: "", style: color };
  }

  // 3. Fallback: random preset
  const entry = PRESET_ENTRIES[Math.floor(Math.random() * PRESET_ENTRIES.length)];
  return { className: entry.twClass, style: entry.hex };
}

export function buildWritingSearchIndex(posts: WritingPost[]) {
  return posts.map((post) => ({
    title: post.data.title,
    description: stripHtml(post.data.description),
    url: getPostUrl(post),
    category: (post.data.category || post.data.categories) ?? "",
    tags: post.data.tags,
    pubDate: post.data.pubDate.toISOString(),
    text: stripHtml(`${post.data.title} ${post.data.description} ${(post.data.category || post.data.categories) ?? ""} ${post.data.tags.join(" ")} ${post.body ?? ""}`),
  }));
}
