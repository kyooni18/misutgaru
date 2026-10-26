/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { describe, expect, it } from 'vitest';
import { placeFloating } from '@/utility/floating-position.js';

const boundary = { left: 10, top: 20, width: 370, height: 600 };

describe('floating placement', () => {
	it('caps an oversized picker to the available side and visible width', () => {
		const result = placeFloating({ left: 280, top: 200, width: 50, height: 40 }, { width: 500, height: 800 }, boundary, 'bottom', 10);
		expect(result).toEqual({ left: 10, top: 250, width: 370, height: 370, side: 'bottom' });
	});

	it('flips a picker above its anchor using its constrained height', () => {
		const result = placeFloating({ left: 100, top: 500, width: 50, height: 40 }, { width: 300, height: 800 }, boundary, 'bottom', 10);
		expect(result).toEqual({ left: 80, top: 20, width: 300, height: 470, side: 'top' });
	});

	it('shifts a submenu into view when neither side fits', () => {
		const result = placeFloating({ left: 200, top: 400, width: 160, height: 40 }, { width: 300, height: 700 }, boundary, 'right', 0);
		expect(result).toEqual({ left: 10, top: 20, width: 300, height: 600, side: 'left' });
	});

	it('keeps panels inside arbitrary viewport sizes and offsets', () => {
		for (const width of [180, 390, 1024]) {
			for (const height of [160, 540, 900]) {
				for (const preferred of ['bottom', 'right'] as const) {
					const viewport = { left: 37, top: 83, width, height };
					const result = placeFloating({ left: width / 2, top: height / 2, width: 48, height: 48 }, { width: 420, height: 700 }, viewport, preferred, 12);
					expect(result.left).toBeGreaterThanOrEqual(viewport.left);
					expect(result.top).toBeGreaterThanOrEqual(viewport.top);
					expect(result.left + result.width).toBeLessThanOrEqual(viewport.left + width);
					expect(result.top + result.height).toBeLessThanOrEqual(viewport.top + height);
				}
			}
		}
	});
});
