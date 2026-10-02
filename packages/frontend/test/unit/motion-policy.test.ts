/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { MotionPolicy } from '@/motion/core/policy.js';

describe('MotionPolicy', () => {
	test('uses the full semantic preset when motion is enabled', () => {
		const policy = new MotionPolicy();
		const resolved = policy.resolve('surfaceEnter', 'spatial');
		expect(resolved).toMatchObject({ duration: 280, disabled: false, reduced: false });
	});

	test('disables all engine motion when the user preference is off', () => {
		const policy = new MotionPolicy();
		policy.configure({ userEnabled: false });
		expect(policy.resolve('surfaceEnter', 'spatial').disabled).toBe(true);
		expect(policy.resolve('surfaceEnter', 'spatial').duration).toBe(0);
	});

	test('reduces spatial motion and removes decorative motion for reduced-motion users', () => {
		const policy = new MotionPolicy();
		policy.configure({ reducedMotion: true });
		expect(policy.resolve('emphasized', 'spatial')).toMatchObject({ duration: 120, disabled: false, reduced: true });
		expect(policy.resolve('emphasized', 'decorative')).toMatchObject({ duration: 0, disabled: true, reduced: true });
	});

	test('does not run one-shot UI motion while the document is hidden', () => {
		const policy = new MotionPolicy();
		policy.configure({ documentVisible: false });
		expect(policy.resolve('control', 'functional').disabled).toBe(true);
	});
});
