/* SPDX-License-Identifier: AGPL-3.0-only */
/* @misutgaru-vune-native */
import { Circle, ZStack } from 'vune-ui';
import '@/components/vune/misskey-vune.scss';

export struct MkLoading: View {
	let isStatic: boolean
	let inline: boolean
	let colored: boolean
	let mini: boolean
	let em: boolean

	init(
		isStatic: boolean = false,
		inline: boolean = false,
		colored: boolean = true,
		mini: boolean = false,
		em: boolean = false,
	) {
		self.isStatic = isStatic
		self.inline = inline
		self.colored = colored
		self.mini = mini
		self.em = em
	}

	var body: some View {
		ZStack(alignment: 'center') {
			Circle().className(['mk-vune-loading__ring', 'mk-vune-loading__ring--background'])
			Circle().className([
				'mk-vune-loading__ring',
				'mk-vune-loading__ring--foreground',
				isStatic ? 'mk-vune-loading__ring--static' : null,
			])
		}
			.className([
				'mk-vune-loading',
				inline ? 'mk-vune-loading--inline' : null,
				colored ? 'mk-vune-loading--colored' : null,
				mini ? 'mk-vune-loading--mini' : null,
				em ? 'mk-vune-loading--em' : null,
			])
	}
}

export default MkLoading
