/* SPDX-License-Identifier: AGPL-3.0-only */
/* @misutgaru-vune-native */
import { HStack, Link, Text } from 'vune-ui';
import { i18n } from '@/i18n.js';
import VuneIcon from '@/vune/Icon.vune.js';
import './misskey-vune.scss';

export struct MkRemoteCaution: View {
	let href: string | undefined

	init(href: string | undefined = undefined) {
		self.href = href
	}

	var body: some View {
		HStack(alignment: 'center', spacing: 0) {
			VuneIcon('ti ti-alert-triangle', className: 'mk-vune-remote-caution__icon')
			Text(i18n.ts.remoteUserCaution)
			if (href) {
				Link(i18n.ts.showOnRemote, href)
					.className('mk-vune-remote-caution__link')
					.withProps({ rel: 'nofollow noopener', target: '_blank' })
			}
		}
			.className('mk-vune-remote-caution')
			.style({ justifyContent: 'flex-start' })
	}
}

export default MkRemoteCaution
