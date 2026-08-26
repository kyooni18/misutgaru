/* SPDX-License-Identifier: AGPL-3.0-only */
/* @misutgaru-vune-native */
import { HStack, Text, VStack } from 'vune-ui';
import type { GridRow } from '@/components/grid/row.js';
import '../../vune/misskey-vune.scss';

export struct MkNumberCell: View {
	let content: string
	let row: GridRow | undefined

	init(_ content: string, row: GridRow | undefined = undefined) {
		self.content = content
		self.row = row
	}

	var body: some View {
		VStack(alignment: 'center', spacing: 0) {
			HStack(alignment: 'center', spacing: 0) {
				Text(content)
			}
				.className('mk-vune-grid-number-cell__content')
		}
			.className(['mk_grid_th', 'mk-vune-grid-number-cell'])
			.withProps({
				tabIndex: -1,
				'data-grid-cell': '',
				'data-grid-cell-row': row?.index ?? -1,
				'data-grid-cell-col': -1,
			})
	}
}

export default MkNumberCell
