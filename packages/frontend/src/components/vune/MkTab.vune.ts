/* SPDX-License-Identifier: AGPL-3.0-only */
/* @misutgaru-vune-native */
import { Button, ForEach, HStack, Text } from 'vune-ui';
import {
	ignoreTabSelection,
	type RuntimeTab,
	type TabKey,
	type TabSelectionAction,
} from './MkTab.types.js';
import './misskey-vune.scss';

export type { Tab } from './MkTab.types.js';

type TabActions = { onSelect: TabSelectionAction };

export struct MkTab: View {
	let tabs: RuntimeTab[]
	let selection: TabKey | undefined
	let actions: TabActions

	init(
		_ tabs: RuntimeTab[],
		selection: TabKey | undefined = undefined,
		@Action onSelect: TabSelectionAction = ignoreTabSelection,
	) {
		self.tabs = tabs
		self.selection = selection
		self.actions = { onSelect }
	}

	var body: some View {
		HStack(alignment: 'center', spacing: 8) {
			ForEach(tabs, key: (option) => option.key) { option in
				Button(action: {
					actions.onSelect(option.key)
				}, label: {
					HStack(alignment: 'center', spacing: 0) {
						Text('')
							.className([option.icon ?? null, 'mk-vune-tab__icon'])
							.withProps({ 'aria-hidden': true })
						Text(String(option.label ?? ''))
					}
				})
					.className([
						'_button',
						'mk-vune-tab__button',
						selection === option.key ? 'mk-vune-tab__button--active' : null,
					])
					.withProps({ disabled: selection === option.key })
			}
		}
			.className('mk-vune-tab')
	}
}

export default MkTab
