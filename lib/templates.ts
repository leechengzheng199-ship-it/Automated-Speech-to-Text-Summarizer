import type { TemplateSection } from "@/lib/types";

export const BUILTIN_TEMPLATES: Array<{
  name: string;
  description: string;
  systemPrompt: string;
  outputLanguage: string;
  sections: TemplateSection[];
  isBuiltin: boolean;
}> = [
  {
    name: "会议纪要",
    description: "提炼议题、结论、待办与待决策事项，适合例会与评审。",
    systemPrompt:
      "你是会议纪要助手。只依据转写原文归纳，不编造未出现的事实。用简体中文输出 Markdown，严格按给定章节标题组织，不要额外添加章节。",
    outputLanguage: "zh",
    isBuiltin: true,
    sections: [
      {
        id: "agenda",
        title: "会议概要",
        instruction: "用 3–6 句话说明会议目的、参与角色（如能从原文判断）与整体结论。",
        format: "paragraph",
      },
      {
        id: "decisions",
        title: "决议与结论",
        instruction: "列出已达成的决定；每条包含决定内容与依据（原文要点）。",
        format: "bullets",
      },
      {
        id: "actions",
        title: "待办事项",
        instruction: "列出待办：事项、负责人（未知则写未指定）、截止时间（未知则写未指定）。",
        format: "table",
      },
      {
        id: "open",
        title: "未决问题",
        instruction: "列出仍有分歧或需要后续讨论的问题。",
        format: "bullets",
      },
    ],
  },
  {
    name: "访谈整理",
    description: "按主题归纳受访者观点、原话摘录与可跟进线索。",
    systemPrompt:
      "你是访谈记录整理助手。区分访谈者提问与受访者回答。引用关键原话时加引号。用简体中文输出 Markdown，严格按给定章节标题组织。",
    outputLanguage: "zh",
    isBuiltin: true,
    sections: [
      {
        id: "profile",
        title: "访谈背景",
        instruction: "概括访谈主题、受访者身份（原文有则写，无则写未知）与核心诉求。",
        format: "paragraph",
      },
      {
        id: "insights",
        title: "观点与洞察",
        instruction: "按主题归纳受访者的主要观点，避免重复。",
        format: "bullets",
      },
      {
        id: "quotes",
        title: "关键原话",
        instruction: "摘录 3–8 条有信息量的原话，保持原意。",
        format: "bullets",
      },
      {
        id: "followup",
        title: "可跟进线索",
        instruction: "列出值得后续追问或核实的问题。",
        format: "bullets",
      },
    ],
  },
  {
    name: "课程笔记",
    description: "把讲解整理成知识点、例子与复习要点。",
    systemPrompt:
      "你是课程笔记助手。突出可复习的知识点，术语保持准确。用简体中文输出 Markdown，严格按给定章节标题组织。",
    outputLanguage: "zh",
    isBuiltin: true,
    sections: [
      {
        id: "overview",
        title: "课程概要",
        instruction: "用一段话说明本节主题与学习目标。",
        format: "paragraph",
      },
      {
        id: "points",
        title: "知识点",
        instruction: "分条列出核心概念、定义与原理。",
        format: "bullets",
      },
      {
        id: "examples",
        title: "例子与演示",
        instruction: "整理讲解中出现的例子、步骤或演示。",
        format: "bullets",
      },
      {
        id: "review",
        title: "复习要点",
        instruction: "给出便于回顾的要点或自测问题。",
        format: "bullets",
      },
    ],
  },
];

export function buildSummaryPrompt(params: {
  systemPrompt: string;
  sections: TemplateSection[];
  transcript: string;
}): { system: string; user: string } {
  const outline = params.sections
    .map((section, index) => {
      const formatHint =
        section.format === "table"
          ? "请用 Markdown 表格输出。"
          : section.format === "bullets"
            ? "请用无序列表输出。"
            : "请用段落输出。";
      return `## ${index + 1}. ${section.title}\n要求：${section.instruction} ${formatHint}`;
    })
    .join("\n\n");

  return {
    system: params.systemPrompt,
    user: `请根据下面的转写原文，按以下结构输出完整 Markdown 文档。不要输出结构之外的前言或结语。\n\n${outline}\n\n---\n转写原文：\n${params.transcript}`,
  };
}
