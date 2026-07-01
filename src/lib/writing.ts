import { getCollection, type CollectionEntry } from "astro:content";

export type WritingPost = CollectionEntry<"blog">;
export type TaxonomyCount = {
  name: string;
  slug: string;
  count: number;
};

const CJK_RE = /[㐀-鿿豈-﫿]/g;
const WORD_RE = /[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g;

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
  return getTaxonomyCounts(posts.flatMap((post) => post.data.category ? [post.data.category] : []));
}

export function getTagCounts(posts: WritingPost[]) {
  return getTaxonomyCounts(posts.flatMap((post) => post.data.tags));
}

export function getSeriesCounts(posts: WritingPost[]) {
  return getTaxonomyCounts(posts.flatMap((post) => post.data.series ? [post.data.series] : []));
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

export function buildWritingSearchIndex(posts: WritingPost[]) {
  return posts.map((post) => ({
    title: post.data.title,
    description: stripHtml(post.data.description),
    url: getPostUrl(post),
    category: post.data.category ?? "",
    tags: post.data.tags,
    pubDate: post.data.pubDate.toISOString(),
    text: stripHtml(`${post.data.title} ${post.data.description} ${post.data.category ?? ""} ${post.data.tags.join(" ")} ${post.body ?? ""}`),
  }));
}
