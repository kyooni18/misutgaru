/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as fs from 'node:fs/promises';
import { WritableStream } from 'node:stream/web';
import type { PathLike } from 'node:fs';
import { BLOCK_IO_WRITE_HIGH_WATER_MARK } from '@/misc/block-io.js';

const MAX_IOV = 1024;

async function writevFully(file: fs.FileHandle, buffers: readonly Buffer[]): Promise<void> {
	let index = 0;
	let offset = 0;

	while (index < buffers.length) {
		const batch: Buffer[] = [];
		for (let i = index; i < buffers.length && batch.length < MAX_IOV; i++) {
			batch.push(i === index && offset > 0 ? buffers[i].subarray(offset) : buffers[i]);
		}

		const { bytesWritten } = await file.writev(batch);
		if (bytesWritten <= 0) throw new Error('FileWriterStream: writev made no progress');

		let consumed = bytesWritten;
		while (index < buffers.length && consumed > 0) {
			const remaining = buffers[index].byteLength - offset;
			if (consumed < remaining) {
				offset += consumed;
				consumed = 0;
			} else {
				consumed -= remaining;
				index += 1;
				offset = 0;
			}
		}
	}
}

/**
 * Web WritableStream backed by a file descriptor. Small chunks are collected
 * and written with writev so JSON exports do not turn every encoded fragment
 * into an individual filesystem write. Backpressure is applied whenever the
 * batch reaches the shared block-I/O threshold.
 */
export class FileWriterStream extends WritableStream<Uint8Array> {
	constructor(path: PathLike) {
		let file: fs.FileHandle | null = null;
		let pending: Buffer[] = [];
		let pendingBytes = 0;

		const flush = async () => {
			if (file === null || pendingBytes === 0) return;
			const buffers = pending;
			pending = [];
			pendingBytes = 0;
			await writevFully(file, buffers);
		};

		super({
			start: async () => {
				file = await fs.open(path, 'a');
			},
			write: async (chunk) => {
				if (file === null) throw new Error('FileWriterStream is not open');
				if (chunk.byteLength === 0) return;

				if (pendingBytes === 0 && chunk.byteLength >= BLOCK_IO_WRITE_HIGH_WATER_MARK) {
					await writevFully(file, [Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)]);
					return;
				}

				// The producer may reuse a Uint8Array after write() resolves, so own a
				// copy while it lives in the delayed writev batch.
				const owned = Buffer.from(chunk);
				pending.push(owned);
				pendingBytes += owned.byteLength;
				if (pendingBytes >= BLOCK_IO_WRITE_HIGH_WATER_MARK || pending.length >= MAX_IOV) {
					await flush();
				}
			},
			close: async () => {
				try {
					await flush();
				} finally {
					await file?.close();
					file = null;
				}
			},
			abort: async () => {
				pending = [];
				pendingBytes = 0;
				await file?.close();
				file = null;
			},
		});
	}
}
