/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { URLSearchParams } from 'node:url';
import sharp from 'sharp';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { OpenAiTranslationError, OpenAiTranslationService, type OpenAiTranslationImageInput, type OpenAiTranslationMedia, type OpenAiTranslationPost } from '@/core/OpenAiTranslationService.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { GetterService } from '@/server/api/GetterService.js';
import { RoleService } from '@/core/RoleService.js';
import { MiMeta } from '@/models/_.js';
import type { MiNote } from '@/models/Note.js';
import type { Packed } from '@/misc/json-schema.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '../../error.js';

const MAX_TARGET_IMAGES = 4;
const MAX_CONTEXT_IMAGES = 4;

export const meta = {
	tags: ['notes'],

	requireCredential: true,
	kind: 'read:account',

	res: {
		type: 'object',
		optional: true, nullable: false,
		properties: {
			sourceLang: { type: 'string' },
			text: { type: 'string' },
			images: {
				optional: true,
				type: 'array',
				items: {
					type: 'object',
					properties: {
						fileId: { type: 'string' },
						kind: { type: 'string', enum: ['translation', 'description', 'skip'] },
						sourceLang: { type: 'string' },
						text: { type: 'string' },
					},
					required: ['fileId', 'kind', 'sourceLang', 'text'],
				},
			},
		},
	},

	errors: {
		unavailable: {
			message: 'Translate of notes unavailable.',
			code: 'UNAVAILABLE',
			id: '50a70314-2d8a-431b-b433-efa5cc56444c',
		},
		noSuchNote: {
			message: 'No such note.',
			code: 'NO_SUCH_NOTE',
			id: 'bea9b03f-36e0-49c5-a4db-627a029f8971',
		},
		cannotTranslateInvisibleNote: {
			message: 'Cannot translate invisible note.',
			code: 'CANNOT_TRANSLATE_INVISIBLE_NOTE',
			id: 'ea29f2ca-c368-43b3-aaf1-5ac3e74bbe5d',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		noteId: { type: 'string', format: 'misskey:id' },
		targetLang: { type: 'string' },
	},
	required: ['noteId', 'targetLang'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	private noteText(note: MiNote): string {
		const text = note.text ?? '';
		return note.cw != null ? `${note.cw}\n-----\n${text}` : text;
	}

	/** Reply ancestors, oldest first. */
	private async getPreviousNotes(note: MiNote, userId: string): Promise<MiNote[]> {
		const previous: MiNote[] = [];
		let current = note;

		for (let depth = 0; depth < 8 && current.replyId; depth++) {
			const parent = await this.getterService.getNote(current.replyId).catch(() => null);
			if (parent == null || !(await this.noteEntityService.isVisibleForMe(parent, userId))) break;
			previous.unshift(parent);
			current = parent;
		}

		return previous;
	}

	private async fetchImage(file: Packed<'DriveFile'>): Promise<OpenAiTranslationImageInput | undefined> {
		try {
			const imageUrl = file.thumbnailUrl ?? file.url;
			const parsedUrl = new URL(imageUrl);
			if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') return undefined;

			const response = await this.httpRequestService.send(imageUrl, {
				timeout: 15_000,
				size: 8 * 1024 * 1024,
			}, {
				throwErrorWhenResponseNotOk: false,
				validators: [],
			});
			if (!response.ok) return undefined;

			const image = await sharp(await response.buffer(), { failOn: 'none' })
				.rotate()
				.resize(768, 768, { fit: 'inside', withoutEnlargement: true })
				.jpeg({ quality: 55, progressive: true })
				.toBuffer();
			return { fileId: file.id, dataUrl: `data:image/jpeg;base64,${image.toString('base64')}` };
		} catch {
			return undefined;
		}
	}

	/**
	 * Builds the target post and its previous posts with their media. Target images
	 * are numbered first so the model's per-image results map back to them; images of
	 * the nearest previous posts follow as reference-only context.
	 */
	private async buildPosts(note: MiNote, previousNotes: MiNote[]) {
		const notes = [note, ...[...previousNotes].reverse()];
		const filesByNote = await Promise.all(notes.map(n => n.fileIds.length > 0 ? this.driveFileEntityService.packManyByIds(n.fileIds) : Promise.resolve([])));

		const imageLimits = [MAX_TARGET_IMAGES, ...notes.slice(1).map(() => 0)];
		let contextBudget = MAX_CONTEXT_IMAGES;
		for (let i = 1; i < notes.length && contextBudget > 0; i++) {
			imageLimits[i] = Math.min(contextBudget, filesByNote[i].filter(f => f.type.startsWith('image/')).length);
			contextBudget -= imageLimits[i];
		}

		const fetched = await Promise.all(filesByNote.map((files, i) =>
			Promise.all(files.filter(f => f.type.startsWith('image/')).slice(0, imageLimits[i]).map(f => this.fetchImage(f)))));

		const images: OpenAiTranslationImageInput[] = [];
		let targetImageCount = 0;
		const posts: OpenAiTranslationPost[] = notes.map((n, i) => {
			const loaded = new Map(fetched[i].filter((image): image is OpenAiTranslationImageInput => image != null).map(image => [image.fileId, image]));
			const media: OpenAiTranslationMedia[] = filesByNote[i].map(file => {
				const image = loaded.get(file.id);
				if (image) images.push(image);
				return {
					type: file.type,
					name: file.name,
					comment: file.comment,
					...(image ? { imageNumber: images.length } : {}),
				};
			});
			if (i === 0) targetImageCount = images.length;
			return { text: (i === 0 ? this.noteText(n) : this.noteText(n).slice(0, 2000)), media };
		});

		const [post, ...nearestFirst] = posts;
		return { post, previous: nearestFirst.reverse(), images, targetImageCount };
	}

	constructor(
		@Inject(DI.meta)
		private serverSettings: MiMeta,

		private noteEntityService: NoteEntityService,
		private getterService: GetterService,
		private httpRequestService: HttpRequestService,
		private roleService: RoleService,
		private openAiTranslationService: OpenAiTranslationService,
		private driveFileEntityService: DriveFileEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const policies = await this.roleService.getUserPolicies(me.id);
			if (!policies.canUseTranslator) {
				throw new ApiError(meta.errors.unavailable);
			}

			const note = await this.getterService.getNote(ps.noteId).catch(err => {
				if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') throw new ApiError(meta.errors.noSuchNote);
				throw err;
			});

			if (!(await this.noteEntityService.isVisibleForMe(note, me.id))) {
				throw new ApiError(meta.errors.cannotTranslateInvisibleNote);
			}

			// makeNotesHiddenBefore などで中身が隠されるノート
			const packedNote = await this.noteEntityService.pack(note, me);
			if (packedNote.isHidden) {
				throw new ApiError(meta.errors.cannotTranslateInvisibleNote);
			}

			let text = note.text ?? '';
			if (note.cw != null) {
				text = `${note.cw}\n-----\n${text}`;
			}

			if (this.openAiTranslationService.isAvailable()) {
				try {
					const previousNotes = await this.getPreviousNotes(note, me.id);
					const { post, previous, images, targetImageCount } = await this.buildPosts(note, previousNotes);
					if (text.trim() === '' && post.media.length === 0) return;
					return await this.openAiTranslationService.translate(post, ps.targetLang, previous, images, targetImageCount);
				} catch (error) {
					if (error instanceof OpenAiTranslationError) {
						throw new ApiError(meta.errors.unavailable, {
							...(error.providerStatus != null ? { providerStatus: error.providerStatus } : {}),
							...(error.providerMessage ? { providerMessage: error.providerMessage } : {}),
						});
					}
					throw error;
				}
			}

			if (text.trim() === '') return;

			if (this.serverSettings.deeplAuthKey == null) {
				throw new ApiError(meta.errors.unavailable);
			}

			let targetLang = ps.targetLang;
			if (targetLang.includes('-')) targetLang = targetLang.split('-')[0];

			const params = new URLSearchParams();
			params.append('text', text);
			params.append('target_lang', targetLang);

			const endpoint = this.serverSettings.deeplIsPro ? 'https://api.deepl.com/v2/translate' : 'https://api-free.deepl.com/v2/translate';

			const res = await this.httpRequestService.send(endpoint, {
				method: 'POST',
				headers: {
					'Authorization': `DeepL-Auth-Key ${this.serverSettings.deeplAuthKey}`,
					'Content-Type': 'application/x-www-form-urlencoded',
					Accept: 'application/json, */*',
				},
				body: params.toString(),
			});

			const json = (await res.json()) as {
				translations: {
					detected_source_language: string;
					text: string;
				}[];
			};

			return {
				sourceLang: json.translations[0].detected_source_language,
				text: json.translations[0].text,
				images: [],
			};
		});
	}
}
