/**
 * LLM Prompt 模板集合
 *
 * 所有模板接收一个词汇列表（VocabEntry[]），返回完整的 system prompt。
 * generate.ts 会将这些 prompt 发送给配置的 LLM provider。
 */

import type { VocabEntry } from "./vocab-parser";

// ── Helpers ──

function vocabListText(entries: VocabEntry[]): string {
  return entries
    .map((e) => {
      let line = `${e.index}. ${e.english} — ${e.chinese}`;
      if (e.notes) line += ` (备注: ${e.notes})`;
      if (e.subEntries) {
        for (const s of e.subEntries) {
          line += `\n   └ ${s.english} — ${s.chinese}`;
        }
      }
      return line;
    })
    .join("\n");
}

// ── Exercise prompt builders ──

export function buildExercisePrompt(
  entries: VocabEntry[],
  types: string[],
  customFormat?: string,
): { system: string; user: string } {
  const vocabText = vocabListText(entries);
  const typeDescriptions: Record<string, string> = {
    en_to_cn: "**看英文写中文**：给出英文短语，要求学生写出对应的中文释义。",
    cn_to_en: "**看中文写英文**：给出中文释义，要求学生写出对应的英文短语。",
    fill_blank:
      "**短语填入例句**：为每个短语设计一个包含空格的例句，学生从词表中选择正确的短语填入。",
    matching:
      "**连线匹配**：左列英文短语，右列中文释义（打乱顺序），学生连线匹配。",
    multiple_choice:
      "**选择释义**：给英文短语，设计4个中文选项（含1个正确答案和3个干扰项）。",
  };

  const typeLines = types
    .filter((t) => typeDescriptions[t])
    .map((t) => `- ${typeDescriptions[t]}`);

  let customSection = "";
  if (customFormat) {
    customSection = `
## 自定义题型
用户指定的题型要求如下。请严格按照此要求出题：
${customFormat}`;
  }

  const system = `你是一位资深的雅思英语教师，正在为学生准备词汇练习材料。

## 任务
根据提供的英语词汇表，生成一份完整的词汇练习册。练习册以 Markdown 格式输出，题目要至少包括提供词汇的80%-100%。

## 题目类型
${typeLines.join("\n")}
${customSection}

## 输出格式要求
1. 用 Markdown 标题 "# 练习册：{主题}" 开头
2. 每个题型一个 "## " 二级标题
3. 练习部分在前，答案部分在后（用 "## 📋 参考答案" 分隔）
4. 答案要完整准确
5. 题目数量：每种题型覆盖约 30% 的词汇（随机选取），词汇多的可分批出题
6. 对于连线题，用 Markdown 表格呈现

## 输出语言
题目说明和框架使用中文，英文短语和例句保持英文。`;

  const user = `## 词汇表
${vocabText}

请根据以上词汇表，生成练习册。`;

  return { system, user };
}

// ── Enrichment prompt builders ──

export interface EnrichOptions {
  examples?: boolean;
  synonymsEn?: boolean;
  synonymsCn?: boolean;
  roots?: boolean;
  categories?: boolean;
}

export function buildEnrichPrompt(
  entries: VocabEntry[],
  options: EnrichOptions,
): { system: string; user: string } {
  const vocabText = vocabListText(entries);

  const enrichments: string[] = [];
  if (options.examples)
    enrichments.push(
      "- **增加例句**：为每个短语添加 1 个雅思写作场景例句。格式：在短语行下方缩进添加 `> 例句：...`",
    );
  if (options.synonymsEn)
    enrichments.push(
      "- **英文同义表达**：为较常见的短语添加英文同义表达。格式：`（同义：xxx, xxx）`",
    );
  if (options.synonymsCn)
    enrichments.push(
      "- **中文同义表达**：为中文释义补充同义说法。格式：`（近义：xxx）`",
    );
  if (options.roots)
    enrichments.push(
      "- **词根词缀解释**：对较难的单词（如 compulsory, vocational, juvenile等）添加词根解释。格式：`💡 compulsory ← com-(共同) + puls(推动) + -ory(形容词后缀)`",
    );
  if (options.categories)
    enrichments.push(
      "- **分类记忆**：在所有条目之后，按主题将词汇分组整理。如「学校教育类」「家庭管教类」「个人发展类」「社会影响类」等。用二级标题和列表呈现。",
    );

  const system = `你是一位资深的雅思英语教师，正在帮助学生丰富词汇笔记。

## 任务
根据提供的词汇表，在原笔记基础上进行内容补充。你需要：

${enrichments.join("\n")}

## 关键规则（非常重要）
1. **保持原有格式**：每个条目必须保留 "数字. 英文  中文" 的基本格式
2. **只追加不删除**：原笔记的所有内容都要保留，你只是在基础上添加新内容
3. **不要修改原始英文和中文**：即使你认为有不准确的地方，也不要改动
4. 新增内容紧跟在对应条目下方，用缩进或 Markdown 格式区分
5. 输出完整的笔记内容（从第1条到最后一条），包含你添加的所有内容

## 输出格式
直接输出完整的 Markdown 笔记内容，从头到尾。不要添加额外的解释文字。`;

  const user = `## 原始词汇笔记
${vocabText}

请在以上笔记基础上添加丰富内容。保留所有原始条目的格式和内容。`;

  return { system, user };
}
