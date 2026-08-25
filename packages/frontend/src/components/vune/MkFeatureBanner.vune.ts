/* SPDX-License-Identifier: AGPL-3.0-only */
/* @misutgaru-vune-native */
import { Image, Text, VStack } from 'vune-ui';
import './misskey-vune.scss';

export struct MkFeatureBanner: View {
	let text: string
	let icon: string
	let color: string

	init(_ text: string, icon: string, color: string) {
		self.text = text
		self.icon = icon
		self.color = color
	}

	var body: some View {
		VStack(alignment: 'center', spacing: 12) {
			Image(icon, { alt: '' })
				.className('mk-vune-feature-banner__img')
			Text(text)
				.className('mk-vune-feature-banner__text')
		}
			.className('mk-vune-feature-banner')
			.background(`linear-gradient(180deg, color(from ${color} srgb r g b / 0.1), color(from ${color} srgb r g b / 0))`)
	}
}

export default MkFeatureBanner
