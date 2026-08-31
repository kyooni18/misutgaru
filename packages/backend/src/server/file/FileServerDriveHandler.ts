/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as fs from 'node:fs';
import rename from 'rename';
import type { Config } from '@/config.js';
import type { IImageStreamable } from '@/core/ImageProcessingService.js';
import { contentDisposition } from '@/misc/content-disposition.js';
import { correctFilename } from '@/misc/correct-filename.js';
import { isMimeImage } from '@/misc/is-mime-image.js';
import type { HttpRequestService } from '@/core/HttpRequestService.js';
import { VideoProcessingService } from '@/core/VideoProcessingService.js';
import { attachStreamCleanup, handleRangeRequest, setFileResponseHeaders, getSafeContentType, needsCleanup } from './FileServerUtils.js';
import type { FileServerFileResolver } from './FileServerFileResolver.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

export class FileServerDriveHandler {
	constructor(
		private config: Config,
		private fileResolver: FileServerFileResolver,
		private assetsPath: string,
		private videoProcessingService: VideoProcessingService,
		private httpRequestService: HttpRequestService,
	) {}

	public async handle(request: FastifyRequest<{ Params: { key: string } }>, reply: FastifyReply) {
		const key = request.params.key;
		const file = await this.fileResolver.resolveFileByAccessKey(key);

		if (file.kind === 'not-found') {
			reply.code(404);
			reply.header('Cache-Control', 'max-age=86400');
			return reply.sendFile('/dummy.png', this.assetsPath);
		}

		if (file.kind === 'unavailable') {
			reply.code(204);
			reply.header('Cache-Control', 'max-age=86400');
			return;
		}

		try {
			if (file.kind === 'remote-link') {
				if (file.fileRole === 'webpublic' && file.mime === 'image/svg+xml') {
					reply.header('Cache-Control', 'max-age=31536000, immutable');

					const url = new URL(`${this.config.mediaProxy}/svg.webp`);
					url.searchParams.set('url', file.url);

					return await reply.redirect(url.toString(), 301);
				}

				return await this.streamRemoteFile(request, reply, file);
			}

			if (file.kind === 'remote') {
				let image: IImageStreamable | null = null;

				if (file.fileRole === 'thumbnail') {
					if (isMimeImage(file.mime, 'sharp-convertible-image-with-bmp')) {
						reply.header('Cache-Control', 'max-age=31536000, immutable');

						const url = new URL(`${this.config.mediaProxy}/static.webp`);
						url.searchParams.set('url', file.url);
						url.searchParams.set('static', '1');

						file.cleanup();
						return await reply.redirect(url.toString(), 301);
					} else if (file.mime.startsWith('video/')) {
						const externalThumbnail = this.videoProcessingService.getExternalVideoThumbnailUrl(file.url);
						if (externalThumbnail) {
							file.cleanup();
							return await reply.redirect(externalThumbnail, 301);
						}

						image = await this.videoProcessingService.generateVideoThumbnail(file.path);
					}
				}

				if (file.fileRole === 'webpublic') {
					if (['image/svg+xml'].includes(file.mime)) {
						reply.header('Cache-Control', 'max-age=31536000, immutable');

						const url = new URL(`${this.config.mediaProxy}/svg.webp`);
						url.searchParams.set('url', file.url);

						file.cleanup();
						return await reply.redirect(url.toString(), 301);
					}
				}

				if (image == null) {
					image = {
						data: handleRangeRequest(reply, request.headers.range as string | undefined, file.file.size, file.path),
						ext: file.ext,
						type: file.mime,
					};

					// handleRangeRequest owns Content-Length for partial responses.
					// Overwriting it with the full size makes browsers wait forever for
					// bytes that are not part of the 206 response.
					if (request.headers.range == null) {
						reply.header('Content-Length', file.file.size);
					}
				}

				attachStreamCleanup(image.data, file.cleanup);

				reply.header('Content-Type', getSafeContentType(image.type));
				reply.header('Cache-Control', 'max-age=31536000, immutable');
				reply.header('Content-Disposition',
					contentDisposition(
						'inline',
						correctFilename(file.filename, image.ext),
					),
				);
				return image.data;
			}

			if (file.fileRole !== 'original') {
				const filename = rename(file.filename, {
					suffix: file.fileRole === 'thumbnail' ? '-thumb' : '-web',
					extname: file.ext ? `.${file.ext}` : '.unknown',
				}).toString();

				setFileResponseHeaders(reply, { mime: file.mime, filename });
				return handleRangeRequest(reply, request.headers.range as string | undefined, file.file.size, file.path);
			} else {
				setFileResponseHeaders(reply, { mime: file.file.type, filename: file.filename, size: file.file.size });
				return handleRangeRequest(reply, request.headers.range as string | undefined, file.file.size, file.path);
			}
		} catch (e) {
			if (file.kind === 'remote') file.cleanup();
			throw e;
		}
	}

	private async streamRemoteFile(
		request: FastifyRequest<{ Params: { key: string } }>,
		reply: FastifyReply,
		file: Extract<Awaited<ReturnType<FileServerFileResolver['resolveFileByAccessKey']>>, { kind: 'remote-link' }>,
	) {
		const headers: Record<string, string> = {
			'Accept-Encoding': 'identity',
		};
		if (request.headers.range != null) headers.Range = request.headers.range;
		const ifRange = request.headers['if-range'];
		if (typeof ifRange === 'string') headers['If-Range'] = ifRange;

		const response = await this.httpRequestService.send(file.url, {
			method: 'GET',
			headers,
			// Media may legitimately take longer than ordinary API fetches while
			// still making progress. The request remains bounded and size-limited.
			timeout: 5 * 60 * 1000,
			size: this.config.maxFileSize,
		}, {
			throwErrorWhenResponseNotOk: false,
		});

		reply.code(response.status);
		reply.header('Content-Type', getSafeContentType(file.mime));
		reply.header('Cache-Control', 'max-age=31536000, immutable');
		reply.header('Content-Disposition', contentDisposition('inline', file.filename));

		for (const header of ['content-range', 'accept-ranges', 'content-length'] as const) {
			const value = response.headers.get(header);
			if (value != null) reply.header(header, value);
		}

		return response.body;
	}
}
