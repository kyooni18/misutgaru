/* SPDX-License-Identifier: AGPL-3.0-only */
/* @misutgaru-vune-native */
import { Divider } from 'vune-ui';
import './misskey-vune.scss';

export struct MkDivider: View {
	let marginTopBottom: string | undefined
	let marginLeftRight: string | undefined
	let borderStyle: string | undefined
	let borderWidth: string | undefined
	let borderColor: string | undefined

	init(
		marginTopBottom: string | undefined = undefined,
		marginLeftRight: string | undefined = undefined,
		borderStyle: string | undefined = undefined,
		borderWidth: string | undefined = undefined,
		borderColor: string | undefined = undefined,
	) {
		self.marginTopBottom = marginTopBottom
		self.marginLeftRight = marginLeftRight
		self.borderStyle = borderStyle
		self.borderWidth = borderWidth
		self.borderColor = borderColor
	}

	var body: some View {
		Divider()
			.className('mk-vune-divider')
			.style({
				...(marginTopBottom ? { marginTop: marginTopBottom, marginBottom: marginTopBottom } : {}),
				...(marginLeftRight ? { marginLeft: marginLeftRight, marginRight: marginLeftRight } : {}),
				...(borderStyle ? { borderStyle } : {}),
				...(borderWidth ? { borderWidth } : {}),
				...(borderColor ? { borderColor } : {}),
			})
	}
}

export default MkDivider
