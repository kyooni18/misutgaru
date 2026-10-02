/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { installMotionCssVariables } from '@/motion/core/tokens.js';

describe('motion CSS tokens', () => {
	test('installs semantic durations and easings for CSS-owned motion', () => {
		const root = document.createElement('div');
		installMotionCssVariables(root);
		expect(root.style.getPropertyValue('--MI-motion-duration-feedback')).toBe('120ms');
		expect(root.style.getPropertyValue('--MI-motion-duration-control')).toBe('180ms');
		expect(root.style.getPropertyValue('--MI-motion-duration-layout')).toBe('240ms');
		expect(root.style.getPropertyValue('--MI-motion-ease-standard')).toContain('cubic-bezier');
	});

	test('suppresses CSS duration tokens under the same reduced-motion policy', () => {
		const root = document.createElement('div');
		installMotionCssVariables(root, { enabled: true, reducedMotion: true });
		expect(root.style.getPropertyValue('--MI-motion-duration-feedback')).toBe('0ms');
		expect(root.style.getPropertyValue('--MI-motion-duration-layout')).toBe('0ms');
		expect(root.style.getPropertyValue('--MI-motion-ease-standard')).toContain('cubic-bezier');
	});

	test('suppresses CSS duration tokens when animation is disabled by the user', () => {
		const root = document.createElement('div');
		installMotionCssVariables(root, { enabled: false, reducedMotion: false });
		expect(root.style.getPropertyValue('--MI-motion-duration-control')).toBe('0ms');
	});
});
