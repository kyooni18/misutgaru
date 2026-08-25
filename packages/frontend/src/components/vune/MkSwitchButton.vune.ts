/* SPDX-License-Identifier: AGPL-3.0-only */
/* @misutgaru-vune-native */
import { Button, Capsule, Circle, ZStack } from 'vune-ui';
import { i18n } from '@/i18n.js';
import { ignoreSwitchToggle, type SwitchActions, type SwitchToggleAction } from './MkSwitchButton.types.js';
import './misskey-vune.scss';

export struct MkSwitchButton: View {
	let checked: boolean
	let disabled: boolean
	let actions: SwitchActions

	init(
		_ checked: boolean,
		disabled: boolean = false,
		@Action onToggle: SwitchToggleAction = ignoreSwitchToggle,
	) {
		self.checked = checked
		self.disabled = disabled
		self.actions = { toggle: onToggle }
	}

	var body: some View {
		Button(action: {
			if (!disabled) {
				actions.toggle()
			}
		}, label: {
			ZStack(alignment: 'leading') {
				Capsule()
					.className('mk-vune-switch-button__track')
				Circle()
					.className([
						'mk-vune-switch-button__knob',
						checked ? 'mk-vune-switch-button__knob--checked' : null,
					])
			}
				.className('mk-vune-switch-button__visual')
		})
			.className([
				'_button',
				'mk-vune-switch-button',
				checked ? 'mk-vune-switch-button--checked' : null,
				disabled ? 'mk-vune-switch-button--disabled' : null,
			])
			.withProps({
				disabled,
				role: 'switch',
				'aria-checked': checked,
				'title': checked ? i18n.ts.itsOn : i18n.ts.itsOff,
				'data-testid': 'switch-toggle',
			})
	}
}

export default MkSwitchButton
