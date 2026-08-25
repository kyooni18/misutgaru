/* SPDX-License-Identifier: AGPL-3.0-only */
/* @misutgaru-vune-native */
import { HStack, Text } from 'vune-ui';
import * as Misskey from 'misskey-js';
import { toUnicode } from 'punycode.js';
import { host } from '@@/js/config.js';

export struct MkAcct: View {
	let user: Misskey.entities.UserLite
	let detail: boolean

	init(_ user: Misskey.entities.UserLite, detail: boolean = false) {
		self.user = user
		self.detail = detail
	}

	var body: some View {
		HStack(alignment: 'center', spacing: 0) {
			Text(`@${user.username}`)
			if (user.host || detail) {
				Text(`@${user.host || toUnicode(host)}`).opacity(0.5)
			}
		}
			.style({ width: 'auto', display: 'inline-flex' })
	}
}

export default MkAcct
