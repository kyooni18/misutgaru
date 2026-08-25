/* SPDX-License-Identifier: AGPL-3.0-only */
/* @misutgaru-vune-native */
import { Circle, ZStack } from 'vune-ui';
import VuneIcon from '@/vune/Icon.vune.js';
import '@/components/vune/misskey-vune.scss';

export type SystemIconType = 'info' | 'question' | 'success' | 'warn' | 'error' | 'waiting';

function systemGlyph(type: SystemIconType): string {
	if (type === 'info') return 'ti ti-info-circle';
	if (type === 'question') return 'ti ti-help-circle';
	if (type === 'success') return 'ti ti-check';
	if (type === 'warn') return 'ti ti-alert-triangle';
	if (type === 'error') return 'ti ti-x';
	return 'ti ti-loader-2';
}

export struct MkSystemIcon: View {
	let type: SystemIconType

	init(_ type: SystemIconType) {
		self.type = type
	}

	var body: some View {
		ZStack(alignment: 'center') {
			if (type === 'waiting') {
				Circle().className(['mk-vune-system-icon__ring', 'mk-vune-system-icon__ring--background'])
				Circle().className(['mk-vune-system-icon__ring', 'mk-vune-system-icon__ring--waiting'])
			} else if (type !== 'warn') {
				Circle().className(['mk-vune-system-icon__ring', 'mk-vune-system-icon__ring--draw'])
			}
			VuneIcon(
				systemGlyph(type),
				className: type === 'waiting'
					? 'mk-vune-system-icon__glyph mk-vune-system-icon__glyph--hidden'
					: 'mk-vune-system-icon__glyph',
			)
		}
			.className(['mk-vune-system-icon', `mk-vune-system-icon--${type}`])
	}
}

export default MkSystemIcon
