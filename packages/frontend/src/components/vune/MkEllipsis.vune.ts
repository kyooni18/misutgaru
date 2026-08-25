/* SPDX-License-Identifier: AGPL-3.0-only */
/* @misutgaru-vune-native */
import { HStack, Text } from 'vune-ui';
import './misskey-vune.scss';

export struct MkEllipsis: View {
	let isStatic: boolean

	init(isStatic: boolean = false) {
		self.isStatic = isStatic
	}

	var body: some View {
		HStack(alignment: 'center', spacing: 0) {
			Text('.').className('mk-vune-ellipsis__dot')
			Text('.').className('mk-vune-ellipsis__dot')
			Text('.').className('mk-vune-ellipsis__dot')
		}
			.className(['mk-vune-ellipsis', isStatic ? 'mk-vune-ellipsis--static' : null])
			.style({ width: 'auto', display: 'inline-flex' })
	}
}

export default MkEllipsis
