/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { assert, describe, test } from 'vitest';
import {
	contextMenuAnimation,
	contextMenuContentKeyframes,
	contextMenuDrawerKeyframes,
	contextMenuRootKeyframes,
	contextMenuScaleProperty,
} from '@/components/MkContextMenu.motion.js';

describe('context menu motion', () => {
	test('scales the menu without animating parent opacity', () => {
		const enter = contextMenuRootKeyframes('enter');
		const leave = contextMenuRootKeyframes('leave');

		assert.deepStrictEqual(enter, [
			{ [contextMenuScaleProperty]: 0.9 },
			{ [contextMenuScaleProperty]: 1 },
		]);
		for (const frame of enter) {
			assert.ok(!Object.hasOwn(frame, 'opacity'));
			assert.ok(!Object.hasOwn(frame, 'transform'));
		}
		assert.deepStrictEqual(leave, [
			{ [contextMenuScaleProperty]: 1, opacity: 1 },
			{ [contextMenuScaleProperty]: 0.9, opacity: 0 },
		]);
		assert.equal(contextMenuAnimation.descriptor.kind, 'spring');
		assert.deepStrictEqual(contextMenuContentKeyframes('enter'), [
			{ transform: 'scale(0.9)' },
			{ transform: 'scale(1)' },
		]);
		assert.deepStrictEqual(contextMenuDrawerKeyframes('enter'), [
			{ transform: 'translateY(100%)' },
			{ transform: 'translateY(0)' },
		]);
	});
});
