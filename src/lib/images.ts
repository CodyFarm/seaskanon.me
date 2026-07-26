import type { ImageMetadata } from "astro";

export type HeroImageLoader = () => Promise<{ default: ImageMetadata }>;

export const heroImages = import.meta.glob<{ default: ImageMetadata }>(
  [
    "/src/assets/**/*.{webp,jpeg,jpg,png,gif,avif,svg}",
    "/src/content/blog/**/assets/**/*.{webp,jpeg,jpg,png,gif,avif,svg}",
    "/src/content/**/*.{webp,jpeg,jpg,png,gif,avif,svg}",
    "/public/**/*.{webp,jpeg,jpg,png,gif,avif,svg}",
  ],
  { eager: false },
);

export function getHeroImageLoader(
  cover: string | undefined,
): HeroImageLoader | undefined {
  if (!cover) return undefined;
  // Try the exact path first, then try with leading slash normalised
  const loader = heroImages[cover] ?? heroImages[cover.replace(/^\/+/, "/")];
  return typeof loader === "function" ? loader : undefined;
}
