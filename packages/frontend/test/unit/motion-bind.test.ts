/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { bindMotionStyle } from '@/motion/core/bind.js';
import { MotionValue } from '@/motion/core/motion-value.js';

describe('bindMotionStyle', () => {
	test('binds without a reactive render loop and restores the previous inline style', () => {
		const element = document.createElement('div');
		element.style.setProperty('--offset', '4px');
		const value = new MotionValue(10);
		const unbind = bindMotionStyle(element, '--offset', value, current => `${current}px`);
		expect(element.style.getPropertyValue('--offset')).toBe('10px');
		value.set(25);
		expect(element.style.getPropertyValue('--offset')).toBe('25px');
		unbind();
		expect(element.style.getPropertyValue('--offset')).toBe('4px');
	});
});
