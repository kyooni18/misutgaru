/* SPDX-License-Identifier: AGPL-3.0-only */
/* @misutgaru-vune-native */
import { Button, HStack, Text } from 'vune-ui';
import { ignoreTagAction, type TagAction, type TagActions } from './MkTagItem.types.js';
import './misskey-vune.scss';

struct TagExtraButton: View {
	let iconClass: string
	let actions: TagActions

	init(_ iconClass: string, actions: TagActions) {
		self.iconClass = iconClass
		self.actions = actions
	}

	var body: some View {
		Button(action: {
			actions.onExtra()
		}, label: {
			Text('')
				.className(['mk-vune-tag-item__extra-icon', iconClass])
				.withProps({ 'aria-hidden': true })
		})
			.className(['_button', 'mk-vune-tag-item__extra-button'])
	}
}

export struct MkTagItem: View {
	let iconClass: string | undefined
	let content: string
	let extraIconClass: string | undefined
	let actions: TagActions

	init(
		_ content: string,
		icon: string | undefined = undefined,
		extraIcon: string | undefined = undefined,
		@Action onClick: TagAction = ignoreTagAction,
		@Action onExtra: TagAction = ignoreTagAction,
	) {
		self.content = content
		self.iconClass = icon
		self.extraIconClass = extraIcon
		self.actions = { onClick, onExtra }
	}

	var body: some View {
		HStack(alignment: 'center', spacing: 3) {
			if (iconClass) {
				Text('')
					.className(['mk-vune-tag-item__icon', iconClass])
					.withProps({ 'aria-hidden': true })
			}
			Text(content)
			if (extraIconClass) {
				TagExtraButton(extraIconClass, actions: actions)
			}
		}
			.className('mk-vune-tag-item')
			.withProps({
				role: 'button',
				tabIndex: 0,
				onClick: actions.onClick,
			})
	}
}

export default MkTagItem
