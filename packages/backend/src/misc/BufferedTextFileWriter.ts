/*
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Text-oriented facade over FileWriterStream. Calls to write() are cheap until
 * the shared block-I/O batch is full; the underlying stream then emits one
 * writev batch instead of one filesystem write per JSON/CSV fragment.
 */
import type { PathLike } from 'node:fs';
import { FileWriterStream } from '@/misc/FileWriterStream.js';

export class BufferedTextFileWriter {
	private readonly encoder = new TextEncoder();
	private readonly writer: WritableStreamDefaultWriter<Uint8Array>;

	constructor(path: PathLike) {
		this.writer = new FileWriterStream(path).getWriter();
	}

	public write(text: string): Promise<void> {
		return this.writer.write(this.encoder.encode(text));
	}

	public close(): Promise<void> {
		return this.writer.close();
	}

	public abort(reason?: unknown): Promise<void> {
		return this.writer.abort(reason);
	}
}
