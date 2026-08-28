/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { buildTranslationUserText, openAiChatCompletionsEndpoint, parseTranslationResponse, translationSystemPrompt } from '@misutgaru/core';
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

		let endpoint: URL;
		try {
			endpoint = openAiChatCompletionsEndpoint(openaiTranslation.baseUrl);
		} catch {
			throw new OpenAiTranslationError('OpenAI translation URL is invalid.');
		}

		const userText = buildTranslationUserText(text, targetLang, context);
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
							content: translationSystemPrompt,
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

			const parsed = parseTranslationResponse(content, images.map(image => image.fileId));
			if (parsed) return parsed;

			return { sourceLang: 'unknown', text: content, images: [] };
		} catch (error) {
			if (error instanceof OpenAiTranslationError) throw error;
			throw new OpenAiTranslationError();
		}
	}
}
