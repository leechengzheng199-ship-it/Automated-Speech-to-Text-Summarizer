/**
 * OpenAI-compatible chat completions for structured summaries.
 * Real HTTP calls will be wired in a later iteration.
 */

export type LlmSettings = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export function isLlmConfigured(settings: LlmSettings) {
  return Boolean(settings.baseUrl && settings.apiKey && settings.model);
}

export async function generateSummary(_params: {
  settings: LlmSettings;
  system: string;
  user: string;
}): Promise<{ markdown: string; rawOutput: string }> {
  throw new Error("LLM 总结尚未接入，请等待后续迭代。");
}
