# Vocab Studio 词汇库与短写作 Implementation Plan

> **For agentic workers:** Use the executing-plans skill to implement this plan task-by-task in the current session. Steps use checkbox syntax for tracking. Do not delegate unless separately authorized.

**Goal:** 让管理员维护最小词汇库，并完成由新词与复习词驱动的段落写作、AI 批改和状态更新。

**Architecture:** Astro 组件负责页面结构，TypeScript 模块负责交互，API 负责认证和输入边界。JSON 文件由独立存储模块串行更新；选词和批改校验独立于模型请求。复用现有 LLM 提供商配置。

**Tech Stack:** Node 22、Astro 6、TypeScript、现有 Tailwind 与主题变量、node:test；需要时仅添加 tsx 作为运行 TypeScript 测试的开发依赖。

**Spec:** `../specs/2026-09-10-vocab-writing-practice-design.md`。规格是业务行为与错误状态的依据，执行前全文阅读。

## Global Constraints

- 沿用管理员登录、Astro 6、Node 22 和现有主题。
- 不增加 id、次数、错误类型、来源、备注等持久化字段。
- 首版支持单个 Node 服务进程。
- 词汇库永久保存；本轮任务、草稿和批改在 sessionStorage 保存。
- 所有新 API 使用现有 isAuthenticated，并对写请求验证同源 Origin，使用 application/json。
- 真实词库和临时文件加入 gitignore，不提交到 Git，不放在 src/data。
- 默认不自动重试付费请求，按钮可手动重试。为新接口提供 60 秒超时。
- 实现前后运行 pnpm build；函数与接口用离线模型 stub 验证，真模型调用单独记录是否完成。
- 原工作区已有两处精神分析文章变动，开发提交不得包含这些内容。
- 只修改本仓库；不改 ref-project 或 PhilosopherRoundtable。使用双引号、两空格、分号和已有 @/ 别名。

## 文件职责

路径相对于 `seaskanon.me/`：

| 文件 | 职责 |
| --- | --- |
| src/lib/vocab/types.ts | 词汇、任务、反馈与请求类型 |
| src/lib/vocab/libraryRules.ts | 规范化、业务校验、五档定义 |
| src/lib/vocab/libraryStore.ts | 路径、读写队列、revision、原子替换 |
| src/lib/vocab/selectWritingWords.ts | 确定性选词 |
| src/lib/vocab/llmClient.ts | 从 generate.ts 抽取 provider 适配 |
| src/lib/vocab/writingContracts.ts | 任务与批改 JSON 的运行时校验 |
| src/lib/vocab/writingPrompts.ts | IELTS 风格出题与批改提示 |
| src/lib/vocab/writingService.ts | 出题、批改与时间保存协调 |
| src/lib/vocab/practiceToken.ts | 时间保存重试令牌 |
| src/lib/vocab/http.ts | 新接口认证、同源检查、输入大小和错误映射 |
| src/pages/api/vocab/library.ts | 词库 CRUD |
| src/pages/api/vocab/library/practice.ts | 批改时间保存重试 |
| src/pages/api/vocab/writing/task.ts | 任务生成 |
| src/pages/api/vocab/writing/grade.ts | 批改 |
| src/components/vocab/VocabLibrary.astro | 表格、筛选、编辑抽屉 |
| src/components/vocab/WritingPractice.astro | 配置、任务、写作、反馈结构 |
| src/scripts/vocab/library.ts | CRUD、筛选与冲突交互 |
| src/scripts/vocab/writing.ts | 写作状态机与请求关联 |
| src/scripts/vocab/session.ts | 本标签页保存和恢复 |
| src/scripts/vocab/text.ts | 词数、词形出现提示 |
| src/pages/tools/vocab-studio.astro | 新页签与组件集成 |
| tests/vocab/*.test.ts | 离线业务与接口验证 |
| docs/vocab-studio-operations.md | 持久目录配置、备份恢复与验证记录 |

不把现有 1,000 多行页面脚本整体迁移到一个新文件。只抽取新功能需要的认证状态通知和页签接入，保留旧流程局部逻辑；新逻辑进入独立模块。

## Task 1：词汇数据契约

**Files:** types.ts、libraryRules.ts、tests/vocab/libraryRules.test.ts；package.json 和锁文件仅按测试运行器需要修改。

**Interfaces:** 导出 `Mastery = 1|2|3|4|5`、`VocabEntry`、`EditableEntry`、`normalizeWordKey(word: string): string`、`validateEditable(input: unknown): EditableEntry`。VocabEntry 精确包含规格的七个字段，EditableEntry 只包含 word、partOfSpeech、meaningZh、meaningEn、mastery。

- [ ] 在 Node 22 环境记录 `node --version`、`pnpm --version`，运行 `pnpm build` 保存基线；当前交互终端曾显示 Node 24，不能把它记作 Node 22 验证。
- [ ] 准備 node:test + tsx 运行器，并编写下面的规则测试。测试不读取真实词库。

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWordKey, validateEditable } from "../../src/lib/vocab/libraryRules";

test("normalizes a phrase key without discarding display case", () => {
  assert.equal(normalizeWordKey("  Take   Part  "), "take part");
  const input = { word: "English", partOfSpeech: "noun", meaningZh: "英语", meaningEn: "a language", mastery: 1 };
  assert.equal(validateEditable(input).word, "English");
  assert.throws(() => validateEditable({ ...input, mastery: 6 }));
  assert.throws(() => validateEditable({ ...input, addedAt: "2020-01-01" }));
});
```

- [ ] 运行 `pnpm exec tsx --test tests/vocab/libraryRules.test.ts`，确认缺少实现时失败。
- [ ] 实现 NFKC、trim、空白折叠与白名单字段长度校验；错误使用 `{ code, message }` 可映射异常。单词展示大小写保留，key 才转小写。

```ts
export function normalizeWordKey(word: string): string {
  return word.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}
```

- [ ] 增加空字符串、非字符串、mastery 小数和短语测试，执行本文件通过后提交该任务文件。

## Task 2：可靠文件读写

**Files:** libraryStore.ts、tests/vocab/libraryStore.test.ts、.gitignore、docs/vocab-studio-operations.md。

**Interfaces:** `createLibraryStore(directory: string, clock?: () => Date): LibraryStore`。实例提供 `read(): Promise<LibrarySnapshot>`、`create(entry, expectedRevision)`、`update(originalWord, patch, expectedRevision)`、`remove(word, expectedRevision)`、`markPracticed(words, practicedAt)`；`LibrarySnapshot = { entries: VocabEntry[]; revision: string }`。前三种写入返回新 snapshot；markPracticed 返回 `{ updated: string[]; skipped: string[] }`。生产 API 共用一个 store 实例。

- [ ] 用 mkdtemp 建立临时目录，写空库初始化、日期保护和并发冲突测试。

```ts
const initial = await store.read();
const entry = { word: "compulsory", partOfSpeech: "adjective", meaningZh: "强制的", meaningEn: "required", mastery: 1 as const };
const results = await Promise.allSettled([
  store.create(entry, initial.revision),
  store.create({ ...entry, word: "access" }, initial.revision),
]);
assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
assert.equal((await store.read()).entries.length, 1);
```

- [ ] 运行 `pnpm exec tsx --test tests/vocab/libraryStore.test.ts` 验证失败，再实现读写队列。一个操作失败不得中断后续队列。

```ts
let tail: Promise<unknown> = Promise.resolve();
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = tail.then(operation);
  tail = result.catch(() => undefined);
  return result;
}
```

- [ ] 队列内部重读文件、比较 SHA-256 内容 revision、查重复、应用修改、写同目录唯一临时文件、rename；只处理 ENOENT 为首次创建，其他文件错误不降级为空库。
- [ ] 实现 markPracticed 只修改时间、保留其他字段、重复相同时间不推进、不存在词加入 skipped。
- [ ] 增加损坏 JSON 字节不变、改词冲突、修改保留 addedAt、写失败保留旧文件、两次排队时间更新不丢字段的测试。运行本测试文件。
- [ ] .gitignore 添加 `/.local/vocab/`；运维文档明确生产 VOCAB_DATA_DIR 指向持久卷，备份时停止写入并复制 JSON，恢复时先备份当前文件再校验替换。完成后提交该任务文件。

## Task 3：词汇库 API 与界面

**Files:** http.ts、library.ts API、VocabLibrary.astro、scripts/vocab/library.ts、vocab-studio.astro、tests/vocab/libraryApi.test.ts。

**Interfaces:** HTTP helper 导出 `readJson(request): Promise<unknown>`、`authorize(request): void`、`errorResponse(error): Response`；API 处理器内部可注入 store 与认证函数供离线测试，生产接现有 isAuthenticated。客户端 `initLibrary(root: HTMLElement)` 返回 `{ refresh(): Promise<void>; reset(): void }`。

- [ ] 用注入认证与临时 store 的 Request 测试 401、跨域 403、错误内容类型、超大 body、重复 409、未知字段 400、删除 404。

```ts
const req = new Request("http://localhost/api/vocab/library", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: "https://other.example" },
  body: JSON.stringify({ entry, expectedRevision: snapshot.revision }),
});
assert.equal((await handlers.POST({ request: req })).status, 403);
```

- [ ] 运行 `pnpm exec tsx --test tests/vocab/libraryApi.test.ts` 后实现四种方法；返回 Cache-Control: no-store，输入错误不能产生新文件内容。
- [ ] Astro 组件加入统计、搜索、等级和时间筛选、排序、表格、共用编辑抽屉。按钮使用 type=button 和明确 label；等级不能只有颜色。
- [ ] 客户端保存时携带 revision；409 保留表单并提供刷新，成功才关闭抽屉。新增/改名按库规则检查，删除显示词形确认。过滤与排序只影响展示，不修改服务端数组。
- [ ] 接入四页签：笔记侧栏只在旧功能显示；登录成功刷新词库，退出 reset；新页签不触发旧预览保存逻辑。
- [ ] `pnpm dev` 下验证新增、编辑释义、改拼写、冲突、删除、键盘抽屉、窄屏、认证过期。记录结果，提交该任务文件。

## Task 4：复习选词

**Files:** selectWritingWords.ts、types.ts、tests/vocab/selectWritingWords.test.ts。

**Interfaces:** `Mix = "balanced" | "review" | "new"`；`selectWritingWords(entries: VocabEntry[], options: { targetCount: number; mix: Mix; now: Date; selectedWords?: string[] }): VocabEntry[]`。手选时去重并校验 3–6 条且存在；自动按规格名额分配。

- [ ] 写固定时间夹具：新词也是低掌握词、没有熟词、全部熟词、不足 3 个、总量 4 请求 6、手选不存在词。

```ts
const selected = selectWritingWords(entries, { targetCount: 5, mix: "balanced", now });
assert.equal(selected.length, 5);
assert.equal(new Set(selected.map((e) => normalizeWordKey(e.word))).size, 5);
assert.ok(selected.some((e) => e.word === "newest"));
assert.ok(selected.some((e) => e.mastery >= 4));
```

- [ ] 运行 `pnpm exec tsx --test tests/vocab/selectWritingWords.test.ts` 验证失败。
- [ ] 实现按新词→低掌握→熟词角色选择；候选移除已选 key，缺位全库补足；从未练习优先，之后按旧时间与等级排序，最后 key 稳定排序。
- [ ] 固定时钟运行全部选词用例，通过后提交任务文件。不要加入隐藏的随机性或长期评分字段。

## Task 5：复用 LLM 与生成任务

**Files:** llmClient.ts、writingContracts.ts、writingPrompts.ts、writingService.ts、types.ts、writing/task.ts、原 generate.ts、tests/vocab/task.test.ts、tests/vocab/llmClient.test.ts。

**Interfaces:** `complete(messages, options?): Promise<string>`，options 含 timeoutMs、maxTokens、temperature；`generateTask(input, deps): Promise<WritingTask>`，deps 包含 store、complete、clock。WritingTask 字段严格对应规格第 6 节。

- [ ] 用 fetch stub 测试现有 Anthropic system/message 分离、OpenAI/custom endpoint 规范化、文本块提取、空响应；记录原 generate API 的输出形状。
- [ ] 抽取原 provider 逻辑；旧 generate 调用保持原默认值，新调用设置 timeoutMs=60000、有限输出预算，错误映射为不含密钥或上游原文的提示。
- [ ] task 测试让 stub 返回合法题目、incompatible、代码围栏 JSON、缺 instruction。服务端生成 taskId、时间、词汇快照、字数，拒绝模型额外更换目标词。

```ts
const task = await generateTask(input, {
  store, clock: () => now,
  complete: async () => JSON.stringify({ compatible: true, topic: "education", instruction: "Explain one benefit of vocational education.", structureHints: ["Give a reason", "Support it with an example"] }),
});
assert.deepEqual(task.wordLimit, { min: 80, max: 140 });
assert.equal(task.targetWords.length, input.targetCount);
```

- [ ] Prompt 明确只写一个论证段、自然应用词汇、题目前不输出范文；incompatible 返回 422 并保留用户选择。
- [ ] 运行 `pnpm exec tsx --test tests/vocab/task.test.ts tests/vocab/llmClient.test.ts`；确认旧生成与丰富笔记的请求仍有效，提交任务文件。

## Task 6：结构化批改与练习时间

**Files:** writingContracts.ts、writingPrompts.ts、writingService.ts、practiceToken.ts、writing/grade.ts、library/practice.ts、tests/vocab/grade.test.ts、tests/vocab/practiceToken.test.ts。

**Interfaces:** `validateFeedback(raw: unknown, task: WritingTask, text: string): WritingFeedback`；`gradeWriting(input, deps): Promise<{ feedback: WritingFeedback; practice: PracticeResult }>`；PracticeResult 包含 updated、skipped、saved、可选 retryToken。`signPractice(payload, secret): string` / `verifyPractice(token, secret, now): PracticePayload`；payload 包含 words、practicedAt、expiresAt，令牌不持久化到词条。

- [ ] 建立完整批改夹具，测试合法输出、缺维度、分数越界、未用词错误更新时间、虚构原文、重复词或多余词、等级跳两级、null 分数接受。

```ts
assert.throws(() => validateFeedback({ ...feedback, targetWordUsage: [
  { word: "compulsory", status: "used_correctly", evidence: "invented sentence", comment: "ok" },
] }, task, text));
```

- [ ] 运行 `pnpm exec tsx --test tests/vocab/grade.test.ts` 确认失败；实现严格 JSON 解析与嵌套校验，不接受注释、eval 或任意 Markdown 混排。
- [ ] Prompt 要求 IELTS 段落参考、原文证据、最多一级建议、未使用不调整、不自动升到 5、参考后修改不证明独立掌握，生成保持原意的修改稿与独立参考段。
- [ ] grade 先验证响应，再调用 store.markPracticed。保存失败返回已得到的 feedback 和签名 retryToken；模型失败不生成保存令牌。
- [ ] 实现 HMAC 用途前缀、24 小时过期、恒定时间签名比较；重试路由仍需认证。测试令牌篡改、过期、错误密钥、重复重试不推进时间。
- [ ] 用 mock 调用计数断言“只重试存储”不调用 complete；重试不复活已删词，不覆盖已编辑释义。
- [ ] 运行 `pnpm exec tsx --test tests/vocab/grade.test.ts tests/vocab/practiceToken.test.ts`，通过后提交任务文件。

## Task 7：写作界面与恢复

**Files:** WritingPractice.astro、scripts/vocab/writing.ts、session.ts、text.ts、vocab-studio.astro、tests/vocab/text.test.ts、tests/vocab/session.test.ts。

**Interfaces:** `initWriting(root: HTMLElement)` 返回 `{ reset(): void }`；session 模块 `saveSession(state)`、`loadSession()`、`clearSession()`；text 模块 `countWords(text)`、`hasWordForm(text, word)`。SessionState 包含 task、draft、feedback、submissionId、referenceViewed、pendingPracticeToken；没有历次作文数组。

- [ ] text 测试确认英文缩写、连字符计数策略前后一致，art 不命中 part，短语空白可折叠。

```ts
assert.equal(hasWordForm("This is part of the plan.", "art"), false);
assert.equal(hasWordForm("Compulsory education matters.", "compulsory"), true);
```

- [ ] 用注入的 storage stub 验证刷新恢复、损坏 JSON 忽略、quota 错误不阻止输入；`pnpm exec tsx --test tests/vocab/text.test.ts tests/vocab/session.test.ts`。
- [ ] 实现配置页和目标词预览、单段编辑器、结果分块；自动主题和 mix 预设降低日常配置成本。展示“出现提示”与“批改确认”不同标签。
- [ ] 实现状态机、请求 ID 比对与 AbortController，离开题目或修改原文后旧响应不得覆盖新状态。提交时冻结原文快照；失败保留可编辑文本。
- [ ] 防抖 sessionStorage 保存并显示状态；登录过期可恢复，主动退出清空。开新题前提示有未提交修改。
- [ ] 结果允许逐词采纳建议，PATCH 使用最新 revision；单词已经更名或删除时显示跳过。显示存储重试状态，下一题不隐式接受等级建议。
- [ ] 手动走通修改重交、查看参考标记、窄屏布局、键盘提交、刷新恢复、断网重试和两标签页冲突；提交任务文件。

## Task 8：集成验收与交付

**Files:** docs/vocab-studio-operations.md；仅修复验收发现的相关代码。

- [ ] PowerShell 执行全部离线测试：

```powershell
$vocabTestFiles = Get-ChildItem -LiteralPath tests/vocab -Filter '*.test.ts' | ForEach-Object { $_.FullName }
pnpm exec tsx --test $vocabTestFiles
pnpm build
```

- [ ] 启动 pnpm dev，在管理员认证后依次验证旧生成练习册、丰富笔记、新词库、新短写作；离线 stub 测试成功不能替代真实 provider 结果，真实调用未运行须写明。
- [ ] 使用临时 VOCAB_DATA_DIR 验证写入、服务器重启、读取；验证生产无路径配置时错误明确。不能为测试覆盖真实词库。
- [ ] 按规格第 9 节记录验收结果与桌面/移动端截图位置，包含模型与存储失败状态。
- [ ] `git diff --check`；只暂存本功能文件，检查 staged diff 不含 `.env`、`.local/`、dist 或现有文章改动。
- [ ] 提交经过验证的相关修复与运维说明，交付功能范围、测试结果及实际部署是否完成。

## 文档覆盖检查

| 规格 | 任务 |
| --- | --- |
| 最小数据与五档掌握 | 1、3、6 |
| 文件路径、并发、revision、损坏保护 | 2、3、8 |
| 可视化维护和旧页签兼容 | 3、7、8 |
| 新词/复习词混合与少词处理 | 4、5 |
| AI 复用、任务和错误输出 | 5 |
| 证据批改、评分限制、时间保存 | 6 |
| 草稿恢复、修改重交、词形提示 | 7 |
| 浏览器回归和生产持久化条件 | 8 |

执行顺序 1→2→3→4→5→6→7→8。本轮交付为设计与计划，任务复选框保持未完成状态；这些不是已经实现的功能。
