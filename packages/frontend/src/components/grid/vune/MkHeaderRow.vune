/* SPDX-License-Identifier: AGPL-3.0-only */
import { ForEach, HStack } from 'vune-ui';
import { GridEventEmitter } from '@/components/grid/grid.js';
import MkHeaderCell from '@/components/grid/MkHeaderCell.vue';
import MkNumberCell from '@/components/grid/MkNumberCell.vue';
import type { Size } from '@/components/grid/grid.js';
import type { GridColumn } from '@/components/grid/column.js';
import type { GridRowSetting } from '@/components/grid/row.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';
import '../../vune/misskey-vune.scss';

type Props = {
	columns: GridColumn[];
	gridSetting: GridRowSetting;
	bus: GridEventEmitter;
	'onOperation:beginWidthChange'?: (sender: GridColumn) => void;
	'onOperation:endWidthChange'?: (sender: GridColumn) => void;
	'onOperation:widthLargest'?: (sender: GridColumn) => void;
	'onChange:width'?: (sender: GridColumn, width: string) => void;
	'onChange:contentSize'?: (sender: GridColumn, size: Size) => void;
};

export default createVuneComponent<Props>((props) => {
	const numberCell = props.gridSetting?.showNumber
		? VueComponent(MkNumberCell, { content: '#', top: true })
		: null;
	const headerCell = (column: GridColumn) => VueComponent(MkHeaderCell, {
		column,
		bus: props.bus,
		'onOperation:beginWidthChange': (sender: GridColumn) => props['onOperation:beginWidthChange']?.(sender),
		'onOperation:endWidthChange': (sender: GridColumn) => props['onOperation:endWidthChange']?.(sender),
		'onOperation:widthLargest': (sender: GridColumn) => props['onOperation:widthLargest']?.(sender),
		'onChange:width': (sender: GridColumn, width: string) => props['onChange:width']?.(sender, width),
		'onChange:contentSize': (sender: GridColumn, size: Size) => props['onChange:contentSize']?.(sender, size),
	});

	return HStack(alignment: 'center', spacing: 0) {
		numberCell
		ForEach(props.columns ?? [], key: (column) => column.index) { column in
			headerCell(column)
		}
	}
		.className('mk_grid_tr mk-vune-grid-header-row')
		.withProps({ 'data-grid-row': -1 });
});
