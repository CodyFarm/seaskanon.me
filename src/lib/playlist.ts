import rawPlaylist from "@/assets/BGM/playlist.json";

export interface Track {
  id: number;
  title: string;
  artist: string;
  src: string;
  cover: string;
}

interface RawTrack {
  id: number;
  title?: string;
  artist?: string;
  file: string;
  cover?: string;
}

const audioModules = import.meta.glob<string>(
  "/src/assets/BGM/*.mp3",
  { eager: true, query: "?url", import: "default" },
);

const coverModules = import.meta.glob<string>(
  "/src/assets/BGM_pic/*.{jpg,jpeg,png,webp}",
  { eager: true, query: "?url", import: "default" },
);

function normalizeFilename(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function findModuleUrl(
  modules: Record<string, string>,
  filename: string,
): string | undefined {
  const target = normalizeFilename(filename);
  for (const [path, url] of Object.entries(modules)) {
    const basename = normalizeFilename(path.split("/").pop() ?? "");
    if (basename === target) return url;
  }
  return undefined;
}

function getAudioFilename(path: string): string {
  return path.split("/").pop()!.replace(/\.mp3$/i, "").trim();
}

const typedPlaylist = rawPlaylist as RawTrack[];

export const tracks: Track[] = typedPlaylist
  .slice()
  .sort((a, b) => a.id - b.id)
  .map((item) => {
    const src = findModuleUrl(audioModules, item.file);
    const cover = item.cover
      ? findModuleUrl(coverModules, item.cover) ??
        Object.values(coverModules)[0] ??
        ""
      : Object.values(coverModules)[0] ?? "";

    return {
      id: item.id,
      title: item.title?.trim() || getAudioFilename(item.file),
      artist: item.artist?.trim() || "seasKanon",
      src: src || "",
      cover,
    };
  })
  .filter((track) => track.src);
