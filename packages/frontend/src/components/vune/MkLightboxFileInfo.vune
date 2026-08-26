/* SPDX-License-Identifier: AGPL-3.0-only */
/* @misutgaru-vune-native */
import { Text, VStack } from 'vune-ui';
import { i18n } from '@/i18n.js';
import type { Content } from '@/components/MkLightbox.types.js';
import './misskey-vune.scss';

struct FileInfoRow: View {
	let keyText: string
	let valueText: string
	let preserveWhitespace: boolean

	init(_ keyText: string, value: string, preserveWhitespace: boolean = false) {
		self.keyText = keyText
		self.valueText = value
		self.preserveWhitespace = preserveWhitespace
	}

	var body: some View {
		VStack(alignment: 'leading', spacing: 4) {
			Text(keyText)
				.className('mk-vune-lightbox-fileinfo__key')
			Text(valueText)
				.className([
					'_selectable',
					'mk-vune-lightbox-fileinfo__value',
					preserveWhitespace ? 'mk-vune-lightbox-fileinfo__value--pre' : null,
				])
		}
			.className('mk-vune-lightbox-fileinfo__row')
	}
}

export struct MkLightboxFileInfo: View {
	let content: Content

	init(_ content: Content) {
		self.content = content
	}

	var body: some View {
		VStack(alignment: 'leading', spacing: 12) {
			if (content.filename != null) {
				FileInfoRow(i18n.ts.fileName, value: content.filename)
			}
			if (content.file != null) {
				FileInfoRow(
					i18n.ts.description,
					value: content.file.comment ? content.file.comment : `(${i18n.ts.none})`,
					preserveWhitespace: true,
				)
			}
		}
			.className(['_gaps_s', 'mk-vune-lightbox-fileinfo'])
	}
}

export default MkLightboxFileInfo
