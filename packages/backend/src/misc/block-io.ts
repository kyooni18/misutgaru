/*
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Shared file-system stream sizing for server hot paths. Node's defaults are
 * conservative; using a larger sequential buffer cuts read/write syscalls
 * without letting every connection reserve a huge amount of memory.
 */
import * as fs from 'node:fs';
import type { PathLike } from 'node:fs';

export const BLOCK_IO_READ_HIGH_WATER_MARK = 128 * 1024;
export const BLOCK_IO_WRITE_HIGH_WATER_MARK = 256 * 1024;
export const BLOCK_IO_HASH_HIGH_WATER_MARK = 512 * 1024;

export function createBufferedReadStream(
	path: PathLike,
	options: fs.ReadStreamOptions = {},
): fs.ReadStream {
	return fs.createReadStream(path, {
		highWaterMark: BLOCK_IO_READ_HIGH_WATER_MARK,
		...options,
	});
}

export function createBufferedWriteStream(
	path: PathLike,
	options: fs.WriteStreamOptions = {},
): fs.WriteStream {
	return fs.createWriteStream(path, {
		highWaterMark: BLOCK_IO_WRITE_HIGH_WATER_MARK,
		...options,
	});
}
