/* SPDX-License-Identifier: AGPL-3.0-only */
/* @misutgaru-vune-native */
import { Text } from 'vune-ui';
import number from '@/filters/number.js';
import './misskey-vune.scss';

function differenceClass(value: number): string {
	if (value > 0) return 'mk-vune-number-diff--plus';
	if (value < 0) return 'mk-vune-number-diff--minus';
	return 'mk-vune-number-diff--zero';
}

export struct MkNumberDiff: View {
	let value: number

	init(_ value: number) {
		self.value = value
	}

	var body: some View {
		Text(`${value > 0 ? '+' : ''}${number(value)}`)
			.className(['ceaaebcd', differenceClass(value)])
	}
}

export default MkNumberDiff
