---
title: Phils roundtable：哲学人的圆桌
description: 加入哲学人的群体，和伟大的思想家们同台辩论——一个支持多 LLM 后端、自定义哲学家、云端同步的结构化 AI 辩论平台
tags:
  - AI
  - philosophy
  - project
categories: tutorial
firstLetterColor: cyan
icon: "4"
pubDate: 2026-07-18
heroImage: \public\images\projects\project01\roundtableposter.png
---

> **在线体验：[roundtable.seaskanon.me](https://roundtable.seaskanon.me/)**

---

## 这是什么？

**哲学人的圆桌（Philosopher's Roundtable）** 是一个 AI 驱动的虚拟哲学家辩论平台。选择一个哲学话题，从柏拉图、康德、尼采、孔子等八位预设哲学家中挑选参与者——AI 将为你呈现一场结构化的多轮辩论。你可以旁观、参与讨论，甚至以主持人身份引导对话走向。

![设置界面](/images/projects/project01/app/c1.png)

---

## 核心功能

### 🤖 结构化多阶段辩论

辩论严格遵循三阶段流程：**开场陈述 → 自由辩论 → 总结陈词**。AI 逐轮生成哲学家发言，在保持角色一致性的同时，确保话题始终聚焦。

每位哲学家的发言都带有**关系标记**——同意 / 反对 / 补充 / 质疑——以彩色徽章展示在消息旁，让辩论结构一目了然。

![辩论主界面 - 三栏布局](/images/projects/project01/app/e2.png)

### 🎭 丰富的哲学家阵容

**8 位预设哲学家**，横跨东西方哲学传统：

| 哲学家 | 时代 | 流派 |
|--------|------|------|
| 柏拉图 | 古希腊 | 观念论 |
| 亚里士多德 | 古希腊 | 经验论 |
| 笛卡尔 | 近代 | 理性主义 |
| 康德 | 近代 | 批判哲学 |
| 尼采 | 近代 | 生命哲学 |
| 马克思 | 近代 | 历史唯物主义 |
| 萨特 | 现代 | 存在主义 |
| 孔子 | 春秋 | 儒家 |

每位哲学家都配有中英文名称、简介和专属配色标识。

### 🧙 自定义哲学家

不只是预设角色——你还可以**创建自定义哲学家**。设定中英文名称、个性描述和提示词，上传 TXT / Markdown / PDF 参考资料来塑造他们的知识背景和观点倾向。

![哲学家选择界面](/images/projects/project01/app/add phis.png)

### 📄 智能参考资料解析

上传 PDF 后，系统使用 `pdfjs-dist` 自动提取文本。AI 可生成参考资料的内容概要（Table of Contents），帮助快速理解上传材料的核心内容。

辩论进行中，系统会通过**关键词加权评分算法**从参考资料中检索最相关的段落，控制在 1000 字符以内——既提供上下文支撑，又不浪费 token 预算。

![辩论详情 - 关系标记与侧边栏](/images/projects/project01/app/c2.png)

---

## 交互亮点

### 🔗 追问与 @提及

对任意哲学家的发言点击 **"追问"**，触发独立的 `/api/followup` 端点，让 AI 以该哲学家的身份给出更深入的角色化回应。

输入 `@哲学家名字` 即可**定向提问**——直接向特定哲学家发起挑战或寻求澄清。

### ⚡ 急欲发言机制

AI 会在辩论中标记哪位哲学家"急欲发言"，主持人点击即可让其登场——营造出真实的讨论张力。
![渴望回答](/images/projects/project01/app/e7.png)
### 💡 苏格拉底式追问

AI 自动生成 **3 个发人深省的问题**来深化辩论，帮助打破僵局或引入新的维度。

![苏格拉底追问与思维导图](/images/projects/project01/app/c6.png)

### 📐 可调整面板

左侧参与者列表和右侧侧边栏（苏格拉底问题 / 辩论关系图）均支持**拖拽调整宽度**——你可以根据自己的阅读习惯自由定制布局。

---

## 技术架构

| 层 | 技术选型 |
|---|---------|
| **前端** | React 19 + TypeScript, Vite 6, Tailwind CSS 4, Motion (Framer Motion), Lucide React, react-markdown |
| **后端** | Express.js 4 + TypeScript |
| **AI 后端** | Google Gemini, OpenAI (GPT-4o / o1 / o3), Anthropic Claude, DeepSeek, 自定义兼容端点 |
| **存储** | 基于文件的 JSON 存储 + 浏览器 localStorage |

### 🧠 多 LLM 后端支持

支持五大类 AI 后端，可随时切换：

- **Google Gemini**
- **OpenAI**（GPT-4o / o1 / o3）
- **Anthropic Claude**
- **DeepSeek**
- **自定义端点**（任意兼容 OpenAI `/v1/chat/completions` 的 API）

思考深度提供 **低 / 中 / 高 / 极高** 四档控制，映射为 Claude 的 thinking budget 或 OpenAI o1/o3 的 reasoning effort。

### ☁️ 用户系统 & 云端同步

- 用户名 + 密码注册登录，邀请码保护
- scrypt 密码哈希 + 每用户独立盐值
- Bearer Token 会话（30 天有效）
- 登录后可**将自定义哲学家上传到共享池**
- 支持**云端会话保存/恢复**，也支持本地 localStorage 存储
- **下载对话**：导出完整辩论记录为 TXT 文件


---

## 开始使用

1. 访问 **[roundtable.seaskanon.me](https://roundtable.seaskanon.me/)**
2. 注册账号（需要邀请码，见文末）
3. 配置你的 AI API Key（支持多种后端）
4. 选择哲学家、设定话题，开始你的第一场辩论

## 开源 & 技术栈

项目基于 MIT 协议开源。技术栈：

- **前端**: React 19 + TypeScript, Vite 6, Tailwind CSS 4, Motion, Lucide React, react-markdown, pdfjs-dist
- **后端**: Express.js 4 + TypeScript, tsx (dev), esbuild (prod)
- **AI SDK**: `@google/genai`, `openai`, `@anthropic-ai/sdk`（懒加载以兼容 Vercel serverless）

---

**世界全都在我们之中，而我在完全在我自身之外（The whole world is within us, yet I am entirely outside of myself）哲学人的圆桌，邀请你来探索那些被遮蔽的问题与观点。——[立即体验](https://roundtable.seaskanon.me/)**

## 邀请码 Invitation codes

*（登录账号与否不影响本地功能使用。若想要本地存储记录请下载网页内容到本地使用）*

1. PHILO-ROUND-TABLE-073 
2. PHILO-ROUND-TABLE-094
3. PHILO-ROUND-TABLE-205
