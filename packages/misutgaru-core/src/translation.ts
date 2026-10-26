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

/** A non-text attachment of a post. `imageNumber` is set when the image itself is attached to the request. */
export type TranslationMedia = {
  type: string;
  name: string;
  comment: string | null;
  imageNumber?: number;
};

export type TranslationPost = {
  text: string;
  media: readonly TranslationMedia[];
};

export const translationSystemPrompt = 'You are a precise translation engine. Translate only the post marked Post to translate into the requested target language. Previous posts in the thread, media descriptions and attached images are reference context: use them to resolve meaning, tone, names and references, but never include them in the main text result. Attached images belonging to the post to translate are listed as target images; for each target image, decide whether to translate readable text or provide a concise visual description. Images of previous posts are reference only and get no entry in the result. Return only JSON with string fields sourceLang and text, plus an images array with one object per target image, in order, containing kind, sourceLang, and text.';

export function openAiChatCompletionsEndpoint(baseUrl: string | undefined): URL {
  const normalized = (baseUrl?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const endpoint = new URL(normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`);
  if (endpoint.protocol !== 'https:' && endpoint.protocol !== 'http:') throw new TypeError('Unsupported OpenAI-compatible URL protocol');
  return endpoint;
}

function describeMedia(media: readonly TranslationMedia[]): string {
  return media.map(item => {
    const image = item.imageNumber != null ? `image #${item.imageNumber}` : item.type;
    const alt = item.comment?.trim() ? `, alt text: ${JSON.stringify(item.comment.trim())}` : '';
    return `\n  - [${image}] ${item.name}${alt}`;
  }).join('');
}

function describePost(post: TranslationPost): string {
  const media = post.media.length > 0 ? `\nMedia:${describeMedia(post.media)}` : '';
  return `${post.text.trim() === '' ? '(no text)' : post.text}${media}`;
}

/**
 * `previous` is ordered oldest first. Target images must be numbered 1..n before
 * any previous-post images so that the result's images array lines up with them.
 */
export function buildTranslationUserText(post: TranslationPost, targetLang: string, previous: readonly TranslationPost[]): string {
  const targetImageCount = post.media.filter(item => item.imageNumber != null).length;
  const previousText = previous.length > 0
    ? `\n\nPrevious posts in the thread, oldest first (reference only; do not translate):\n${previous.map((item, index) => `[${index + 1}] ${describePost(item)}`).join('\n\n')}`
    : '';
  const imageText = targetImageCount > 0
    ? `Images #1-#${targetImageCount} are target images belonging to the post to translate; return one images entry for each, in order. If an image contains useful readable text, return a translated version; otherwise return a short description of the meaningful visual content. Use skip only when neither would help.`
    : 'The post to translate has no target images; return an empty images array.';
  return `Target language: ${targetLang}${previousText}\n\nPost to translate (translate only its text):\n---\n${describePost(post)}\n---\n\n${imageText}`;
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
