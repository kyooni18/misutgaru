/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { MotionPlaybackHandle, MotionScopeLike } from './types.js';

export class MotionScope implements MotionScopeLike {
	private readonly handles = new Set<MotionPlaybackHandle>();
	private disposed = false;

	public track(handle: MotionPlaybackHandle): void {
		if (this.disposed) {
			handle.cancel();
			return;
		}
		this.handles.add(handle);
		void handle.finished.then(() => this.handles.delete(handle));
	}

	public cancelAll(): void {
		for (const handle of [...this.handles]) handle.cancel();
		this.handles.clear();
	}

	public dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.cancelAll();
	}
}
