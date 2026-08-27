/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { HttpRequestService } from './HttpRequestService.js';

type ChatContent =
	| { type: 'text'; text: string }
	| { type: 'image_url'; image_url: { url: string } };

export type OpenAiTranslationImageInput = {
	fileId: string;
	dataUrl: string;
};

export type OpenAiTranslationImageResult = {
	fileId: string;
	kind: 'translation' | 'description' | 'skip';
	sourceLang: string;
	text: string;
};

export type OpenAiTranslationResult = {
	sourceLang: string;
	text: string;
	images: OpenAiTranslationImageResult[];
};

export class OpenAiTranslationError extends Error {
	public constructor(
		message = 'OpenAI translation request failed.',
		public readonly providerStatus?: number,
		public readonly providerMessage?: string,
	) {
		super(message);
	}
}

@Injectable()
export class OpenAiTranslationService {
	constructor(
		@Inject(DI.config)
		private config: Config,

		private httpRequestService: HttpRequestService,
	) {
	}

	public isAvailable(): boolean {
		return this.config.openaiTranslation.enabled && this.config.openaiTranslation.apiKey.trim() !== '';
	}

	public async translate(
		text: string,
		targetLang: string,
		context: readonly string[] = [],
		images: readonly OpenAiTranslationImageInput[] = [],
	): Promise<OpenAiTranslationResult> {
		const openaiTranslation = this.config.openaiTranslation;
		if (!openaiTranslation.enabled || openaiTranslation.apiKey.trim() === '') {
			throw new OpenAiTranslationError('OpenAI translation is not configured.');
		}

		const baseUrl = (openaiTranslation.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
		let endpoint: URL;
		try {
			endpoint = new URL(baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`);
		} catch {
			throw new OpenAiTranslationError('OpenAI translation URL is invalid.');
		}

		if (endpoint.protocol !== 'https:' && endpoint.protocol !== 'http:') {
			throw new OpenAiTranslationError('OpenAI translation URL is invalid.');
		}

		const contextText = context.length > 0
			? `\n\nThread context (reference only; do not translate this section):\n${context.map((item, index) => `[${index + 1}] ${item}`).join('\n')}`
			: '';
		const userText = `Target language: ${targetLang}${contextText}\n\nText to translate (translate only this section):\n---\n${text}\n---\n\nAttached images are numbered in order. For each image, decide whether it contains useful readable text. If so, return a translated version; otherwise return a short description of the meaningful visual content. Use \"skip\" only when neither translation nor description would help.`;
		const userContent: string | ChatContent[] = images.length > 0
			? [{ type: 'text', text: userText }, ...images.map(image => ({ type: 'image_url' as const, image_url: { url: image.dataUrl } }))]
			: userText;

		try {
			const res = await this.httpRequestService.send(endpoint.toString(), {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${openaiTranslation.apiKey}`,
					'Content-Type': 'application/json',
					Accept: 'application/json',
				},
				timeout: 30_000,
				body: JSON.stringify({
					model: openaiTranslation.model || 'gpt-4o-mini',
					messages: [
						{
							role: 'system',
							content: 'You are a precise translation engine. Translate only the text in the section marked "Text to translate" into the requested target language. Thread context and attached images are reference context and must not be included in the main text result. For each attached image, decide whether to translate readable text or provide a concise visual description. Return only JSON with string fields "sourceLang" and "text", plus an "images" array with one object per image containing "kind" ("translation", "description", or "skip"), "sourceLang", and "text".',
						},
						{
							role: 'user',
							content: userContent,
						},
					],
				}),
			}, {
				throwErrorWhenResponseNotOk: false,
				validators: [],
			});

			if (!res.ok) {
				let providerMessage: string | undefined;
				try {
					const errorJson = await res.json() as { error?: { code?: unknown; message?: unknown } };
					const code = typeof errorJson.error?.code === 'string' ? errorJson.error.code : undefined;
					const message = typeof errorJson.error?.message === 'string' ? errorJson.error.message : undefined;
					providerMessage = [code, message].filter(Boolean).join(': ') || undefined;
				} catch {
					// The provider may return a non-JSON error body.
				}
				throw new OpenAiTranslationError('OpenAI translation provider rejected the request.', res.status, providerMessage);
			}

			const json = await res.json() as {
				choices?: Array<{ message?: { content?: string | null } }>;
			};
			const content = json.choices?.[0]?.message?.content;
			if (typeof content !== 'string' || content.trim() === '') {
				throw new Error('OpenAI response did not include translated text');
			}

			try {
				const normalizedContent = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
				const parsed = JSON.parse(normalizedContent) as {
					sourceLang?: unknown;
					text?: unknown;
					images?: Array<{ kind?: unknown; sourceLang?: unknown; text?: unknown }>;
				};
				if (typeof parsed.text === 'string') {
					return {
						sourceLang: typeof parsed.sourceLang === 'string' && parsed.sourceLang.trim() !== '' ? parsed.sourceLang : 'unknown',
						text: parsed.text,
						images: (parsed.images ?? []).map((image, index) => ({
							fileId: images[index]?.fileId ?? '',
							kind: image.kind === 'translation' || image.kind === 'description' || image.kind === 'skip' ? image.kind : 'skip',
							sourceLang: typeof image.sourceLang === 'string' && image.sourceLang.trim() !== '' ? image.sourceLang : 'unknown',
							text: typeof image.text === 'string' ? image.text : '',
						})),
					};
				}
			} catch {
				// Some OpenAI-compatible providers return plain text instead of JSON.
			}

			return { sourceLang: 'unknown', text: content, images: [] };
		} catch (error) {
			if (error instanceof OpenAiTranslationError) throw error;
			throw new OpenAiTranslationError();
		}
	}
}
