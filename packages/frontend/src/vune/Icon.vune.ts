/* SPDX-License-Identifier: AGPL-3.0-only */
/* @misutgaru-vune-native */
import { Text } from 'vune-ui';

export struct VuneIcon: View {
	let iconClass: string
	let extraClass: string | undefined

	init(_ iconClass: string, className extraClass: string | undefined = undefined) {
		self.iconClass = iconClass
		self.extraClass = extraClass
	}

	var body: some View {
		Text('')
			.className([iconClass, extraClass])
			.withProps({ 'aria-hidden': true })
	}
}

export default VuneIcon
