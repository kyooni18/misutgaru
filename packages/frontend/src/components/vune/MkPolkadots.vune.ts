/* SPDX-License-Identifier: AGPL-3.0-only */
/* @misutgaru-vune-native */
import { Rectangle } from 'vune-ui';
import './misskey-vune.scss';

export struct MkPolkadots: View {
	let accented: boolean
	let revered: boolean
	let height: number

	init(accented: boolean = false, revered: boolean = false, height: number = 200) {
		self.accented = accented
		self.revered = revered
		self.height = height
	}

	var body: some View {
		Rectangle()
			.className([
				'mk-vune-polkadots',
				accented ? 'mk-vune-polkadots--accented' : null,
				revered ? 'mk-vune-polkadots--revered' : null,
			])
			.style({ height: `${height}px` })
	}
}

export default MkPolkadots
