import path from "node:path";

/**
 * 词汇库默认存储目录。
 *
 * 仅作为兜底：部署到 Railway 这类容器平台时，应用目录会在每次部署后被重建，
 * 因此生产环境应当挂载持久卷并把 VOCAB_DATA_DIR 指向该卷。
 */
export const DEFAULT_VOCAB_DATA_DIR = path.resolve(".local/vocab");

let warnedAboutFallback = false;

/**
 * 解析词汇库数据目录。
 *
 * 优先级：VOCAB_DATA_DIR（运行时环境变量）> VOCAB_DATA_DIR（构建期内联）> 默认目录。
 */
export function resolveVocabDataDir(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.VOCAB_DATA_DIR || buildTimeDataDir();
  if (configured) return configured;
  warnEphemeralStorage();
  return DEFAULT_VOCAB_DATA_DIR;
}

/** 构建期由 Astro/Vite 内联的环境变量；在测试等非 Astro 环境下不存在。 */
function buildTimeDataDir(): string | undefined {
  const meta = import.meta as ImportMeta & { env?: Record<string, unknown> };
  const value = meta.env?.VOCAB_DATA_DIR;
  return typeof value === "string" && value.trim() ? value : undefined;
}

function warnEphemeralStorage(): void {
  if (warnedAboutFallback) return;
  warnedAboutFallback = true;
  console.warn(
    "[vocab] VOCAB_DATA_DIR is not configured; the vocabulary library is stored in an ephemeral directory and will be lost on the next deploy. Mount a volume and set VOCAB_DATA_DIR to keep it.",
  );
}
