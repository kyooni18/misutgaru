/* SPDX-License-Identifier: AGPL-3.0-only */
import { ForEach, HStack } from 'vune-ui';
import { GridEventEmitter } from '@/components/grid/grid.js';
import MkDataCell from '@/components/grid/MkDataCell.vue';
import MkNumberCell from '@/components/grid/MkNumberCell.vue';
import type { Size } from '@/components/grid/grid.js';
import type { CellValue, GridCell } from '@/components/grid/cell.js';
import type { GridRow, GridRowSetting } from '@/components/grid/row.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';
import '../../vune/misskey-vune.scss';

type Props = {
	row: GridRow;
	cells: GridCell[];
	setting: GridRowSetting;
	bus: GridEventEmitter;
	'onOperation:beginEdit'?: (sender: GridCell) => void;
	'onOperation:endEdit'?: (sender: GridCell) => void;
	'onChange:value'?: (sender: GridCell, value: CellValue) => void;
	'onChange:contentSize'?: (sender: GridCell, size: Size) => void;
};

export default createVuneComponent<Props>((props) => {
	const additionalClasses = (props.row?.additionalStyles ?? []).map(item => item.className ?? null);
	const additionalStyle = Object.assign({}, ...(props.row?.additionalStyles ?? []).map(item => item.style ?? {}));
	const numberCell = props.setting?.showNumber
		? VueComponent(MkNumberCell, {
			content: String((props.row?.index ?? -1) + 1),
			row: props.row,
		})
		: null;
	const dataCell = (cell: GridCell) => VueComponent(MkDataCell, {
		vIf: cell.column.setting.type !== 'hidden',
		cell,
		rowSetting: props.setting,
		bus: props.bus,
		'onOperation:beginEdit': (sender: GridCell) => props['onOperation:beginEdit']?.(sender),
		'onOperation:endEdit': (sender: GridCell) => props['onOperation:endEdit']?.(sender),
		'onChange:value': (sender: GridCell, value: CellValue) => props['onChange:value']?.(sender, value),
		'onChange:contentSize': (sender: GridCell, size: Size) => props['onChange:contentSize']?.(sender, size),
	});

	return HStack(alignment: 'center', spacing: 0) {
		numberCell
		ForEach(props.cells ?? [], key: (cell) => cell.address.col) { cell in
			dataCell(cell)
		}
	}
		.className(['mk_grid_tr', 'mk-vune-grid-data-row', props.row?.ranged ? 'mk-vune-grid-data-row--ranged' : null, ...additionalClasses])
		.style({ width: 'fit-content', ...additionalStyle })
		.withProps({ 'data-grid-row': props.row?.index ?? -1 });
});
