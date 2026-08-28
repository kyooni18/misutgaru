/* SPDX-License-Identifier: AGPL-3.0-only */

export type TranslationImageInput = {
  fileId: string;
  dataUrl: string;
};

export type TranslationImageResult = {
  fileId: string;
  kind: 'translation' | 'description' | 'skip';
  sourceLang: string;
  text: string;
};

export type TranslationResult = {
  sourceLang: string;
  text: string;
  images: TranslationImageResult[];
};

export const translationSystemPrompt = 'You are a precise translation engine. Translate only the text in the section marked Text to translate into the requested target language. Thread context and attached images are reference context and must not be included in the main text result. For each attached image, decide whether to translate readable text or provide a concise visual description. Return only JSON with string fields sourceLang and text, plus an images array with one object per image containing kind, sourceLang, and text.';

export function openAiChatCompletionsEndpoint(baseUrl: string | undefined): URL {
  const normalized = (baseUrl?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const endpoint = new URL(normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`);
  if (endpoint.protocol !== 'https:' && endpoint.protocol !== 'http:') throw new TypeError('Unsupported OpenAI-compatible URL protocol');
  return endpoint;
}

export function buildTranslationUserText(text: string, targetLang: string, context: readonly string[]): string {
  const contextText = context.length > 0
    ? `\n\nThread context (reference only; do not translate this section):\n${context.map((item, index) => `[${index + 1}] ${item}`).join('\n')}`
    : '';
  return `Target language: ${targetLang}${contextText}\n\nText to translate (translate only this section):\n---\n${text}\n---\n\nAttached images are numbered in order. For each image, decide whether it contains useful readable text. If so, return a translated version; otherwise return a short description of the meaningful visual content. Use skip only when neither translation nor description would help.`;
}

export function parseTranslationResponse(content: string, imageIds: readonly string[]): TranslationResult | undefined {
  const normalized = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== 'object') return undefined;
  const value = parsed as { sourceLang?: unknown; text?: unknown; images?: unknown };
  if (typeof value.text !== 'string') return undefined;
  const rawImages = Array.isArray(value.images) ? value.images : [];
  return {
    sourceLang: typeof value.sourceLang === 'string' && value.sourceLang.trim() !== '' ? value.sourceLang : 'unknown',
    text: value.text,
    images: rawImages.slice(0, imageIds.length).map((raw, index) => {
      const image = raw && typeof raw === 'object' ? raw as { kind?: unknown; sourceLang?: unknown; text?: unknown } : {};
      return {
        fileId: imageIds[index] ?? '',
        kind: image.kind === 'translation' || image.kind === 'description' || image.kind === 'skip' ? image.kind : 'skip',
        sourceLang: typeof image.sourceLang === 'string' && image.sourceLang.trim() !== '' ? image.sourceLang : 'unknown',
        text: typeof image.text === 'string' ? image.text : '',
      };
    }),
  };
}
