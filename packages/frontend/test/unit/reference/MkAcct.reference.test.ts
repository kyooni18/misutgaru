/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// Behavioral reference for MkAcct: the exact text a Mün port must render.

import { describe, test, assert, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/vue';
import MkAcct from '@/components/global/MkAcct.vue';

const user = (host: string | null) => ({ username: 'alice', host }) as never;
const text = (props: Record<string, unknown>) => {
	const { container } = render(MkAcct, { props });
	return container.textContent;
};

describe('[reference] MkAcct', () => {
	afterEach(() => cleanup());

	test('local user shows only @username', () => {
		assert.strictEqual(text({ user: user(null) }), '@alice');
	});

	test('remote user shows @username@host', () => {
		assert.strictEqual(text({ user: user('example.com') }), '@alice@example.com');
	});

	test('detail on a local user appends the instance host', () => {
		assert.match(text({ user: user(null), detail: true }) ?? '', /^@alice@.+/);
	});
});
