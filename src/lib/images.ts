import type { ImageMetadata } from "astro";

export type HeroImageLoader = () => Promise<{ default: ImageMetadata }>;

export const heroImages = import.meta.glob<{ default: ImageMetadata }>(
  [
    "/src/assets/**/*.{webp,jpeg,jpg,png,gif,avif}",
    "/src/content/blog/**/assets/**/*.{webp,jpeg,jpg,png,gif,avif,svg}",
    "/src/content/**/*.{webp,jpeg,jpg,png,gif,avif,svg}",
  ],
  { eager: false },
);

export function getHeroImageLoader(
  cover: string | undefined,
): HeroImageLoader | undefined {
  if (!cover) return undefined;
  const loader = heroImages[cover];
  return typeof loader === "function" ? loader : undefined;
}
