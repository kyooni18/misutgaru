/* SPDX-License-Identifier: AGPL-3.0-only */
/* @misutgaru-vune-native */
import { Button, Grid, Text, VStack } from 'vune-ui';
import {
	ignorePositionCell,
	ignorePositionUpdate,
	type PositionActions,
	type PositionCellAction,
	type PositionCellActions,
	type PositionUpdateAction,
} from './MkPositionSelector.types.js';
import './misskey-vune.scss';

struct PositionCell: View {
	let icon: string
	let active: boolean
	let actions: PositionCellActions

	init(_ icon: string, active: boolean, @Action select: PositionCellAction = ignorePositionCell) {
		self.icon = icon
		self.active = active
		self.actions = { select }
	}

	var body: some View {
		Button(action: {
			actions.select()
		}, label: {
			Text('')
				.className(icon)
				.withProps({ 'aria-hidden': true })
		})
			.className(['_button', 'mk-vune-position-selector__item', active ? 'mk-vune-position-selector__item--active' : null])
	}
}

export struct MkPositionSelector: View {
	let x: string
	let y: string
	let actions: PositionActions

	init(
		x: string = 'center',
		y: string = 'center',
		@Action onUpdateX: PositionUpdateAction = ignorePositionUpdate,
		@Action onUpdateY: PositionUpdateAction = ignorePositionUpdate,
	) {
		self.x = x
		self.y = y
		self.actions = { updateX: onUpdateX, updateY: onUpdateY }
	}

	var body: some View {
		VStack(spacing: 0) {
			Grid(columns: 3) {
				PositionCell('ti ti-arrow-up-left', active: x === 'left' && y === 'top', select: {
					actions.updateX('left'); actions.updateY('top')
				})
				PositionCell('ti ti-arrow-up', active: x === 'center' && y === 'top', select: {
					actions.updateX('center'); actions.updateY('top')
				})
				PositionCell('ti ti-arrow-up-right', active: x === 'right' && y === 'top', select: {
					actions.updateX('right'); actions.updateY('top')
				})
				PositionCell('ti ti-arrow-left', active: x === 'left' && y === 'center', select: {
					actions.updateX('left'); actions.updateY('center')
				})
				PositionCell('ti ti-focus-2', active: x === 'center' && y === 'center', select: {
					actions.updateX('center'); actions.updateY('center')
				})
				PositionCell('ti ti-arrow-right', active: x === 'right' && y === 'center', select: {
					actions.updateX('right'); actions.updateY('center')
				})
				PositionCell('ti ti-arrow-down-left', active: x === 'left' && y === 'bottom', select: {
					actions.updateX('left'); actions.updateY('bottom')
				})
				PositionCell('ti ti-arrow-down', active: x === 'center' && y === 'bottom', select: {
					actions.updateX('center'); actions.updateY('bottom')
				})
				PositionCell('ti ti-arrow-down-right', active: x === 'right' && y === 'bottom', select: {
					actions.updateX('right'); actions.updateY('bottom')
				})
			}
				.className('mk-vune-position-selector__items')
		}
			.className('mk-vune-position-selector')
	}
}

export default MkPositionSelector
