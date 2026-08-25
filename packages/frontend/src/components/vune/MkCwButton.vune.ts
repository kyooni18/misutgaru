/* SPDX-License-Identifier: AGPL-3.0-only */
/* @misutgaru-vune-native */
import { Button, HStack, Text } from 'vune-ui';
import * as Misskey from 'misskey-js';
import type { PollEditorModelValue } from '@/components/MkPollEditor.types.js';
import { i18n } from '@/i18n.js';
import { ignoreCwChange, type CwActions, type CwChangeAction } from './MkCwButton.types.js';
import './misskey-vune.scss';

function cwLabel(
	text: string | null,
	renote: Misskey.entities.Note | null | undefined,
	files: Misskey.entities.DriveFile[] | undefined,
	poll: Misskey.entities.Note['poll'] | PollEditorModelValue | null | undefined,
): string {
	let parts: string[] = [];
	if (text) parts.push(i18n.tsx._cw.chars({ count: text.length }));
	if (renote) parts.push(i18n.ts.quote);
	if (files && files.length !== 0) parts.push(i18n.tsx._cw.files({ count: files.length }));
	if (poll != null) parts.push(i18n.ts.poll);
	return parts.join(' / ');
}

export struct MkCwButton: View {
	let modelValue: boolean
	let text: string | null
	let renote: Misskey.entities.Note | null | undefined
	let files: Misskey.entities.DriveFile[] | undefined
	let poll: Misskey.entities.Note['poll'] | PollEditorModelValue | null | undefined
	let actions: CwActions

	init(
		_ modelValue: boolean,
		text: string | null,
		renote: Misskey.entities.Note | null | undefined = undefined,
		files: Misskey.entities.DriveFile[] | undefined = undefined,
		poll: Misskey.entities.Note['poll'] | PollEditorModelValue | null | undefined = undefined,
		@Action onChange: CwChangeAction = ignoreCwChange,
	) {
		self.modelValue = modelValue
		self.text = text
		self.renote = renote
		self.files = files
		self.poll = poll
		self.actions = { change: onChange }
	}

	var body: some View {
		Button(action: {
			actions.change(!modelValue)
		}, label: {
			HStack(alignment: 'center', spacing: 4) {
				Text(modelValue ? i18n.ts._cw.hide : i18n.ts._cw.show).bold()
				if (!modelValue) {
					Text(`(${cwLabel(text, renote, files, poll)})`)
						.className('mk-vune-cw-button__label')
				}
			}
		})
			.className(['_button', 'mk-vune-cw-button'])
	}
}

export default MkCwButton
