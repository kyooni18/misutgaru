/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { onScopeDispose } from 'vue';
import { MotionScope } from '../core/index.js';

export function useMotionScope(): MotionScope {
	const scope = new MotionScope();
	onScopeDispose(() => scope.dispose());
	return scope;
}
