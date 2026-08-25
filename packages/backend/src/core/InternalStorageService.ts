/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as Path from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { bindThis } from '@/decorators.js';
import { BLOCK_IO_READ_HIGH_WATER_MARK } from '@/misc/block-io.js';

@Injectable()
export class InternalStorageService {
	private readonly path: string;
	private readonly storageReady: Promise<void>;

	constructor(
		@Inject(DI.config)
		private config: Config,
	) {
		this.path = Path.resolve(this.config.rootDir, 'files');
		// mkdir used to run synchronously for every save. Create the directory once
		// and let all writers share the same non-blocking readiness promise.
		this.storageReady = fsp.mkdir(this.path, { recursive: true }).then(() => undefined);
	}

	@bindThis
	public resolvePath(key: string) {
		return Path.resolve(this.path, key);
	}

	@bindThis
	public read(key: string) {
		return fs.createReadStream(this.resolvePath(key), {
			highWaterMark: BLOCK_IO_READ_HIGH_WATER_MARK,
		});
	}

	@bindThis
	public async saveFromPath(key: string, srcPath: string): Promise<string> {
		await this.storageReady;
		await fsp.copyFile(srcPath, this.resolvePath(key));
		return `${this.config.url}/files/${key}`;
	}

	@bindThis
	public async saveFromBuffer(key: string, data: Buffer): Promise<string> {
		await this.storageReady;
		await fsp.writeFile(this.resolvePath(key), data);
		return `${this.config.url}/files/${key}`;
	}

	@bindThis
	public async del(key: string): Promise<boolean> {
		await this.storageReady;
		try {
			await fsp.unlink(this.resolvePath(key));
			return true;
		} catch {
			// Preserve the old fire-and-forget deletion semantics: a missing or
			// already-removed file must not fail the surrounding cleanup job.
			return false;
		}
	}
}
