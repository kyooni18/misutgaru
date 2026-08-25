/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Group } from 'vune-ui';
import { createVuneComponent, VueSlot, vuneBoolean } from '@/vune/vue.js';
import './misskey-vune.scss';

type Props = { first?: boolean };

export default createVuneComponent<Props>((props, slots) =>
	Group() {
		Element('div', { className: `mk-vune-form-section${vuneBoolean(props.first) ? ' mk-vune-form-section--first' : ''}` },
			Element('div', { className: `mk-vune-form-section__label${vuneBoolean(props.first) ? ' mk-vune-form-section__label--first' : ''}` }, VueSlot(slots.label)),
			Element('div', { className: 'mk-vune-form-section__description' }, VueSlot(slots.description)),
			Element('div', { className: 'mk-vune-form-section__main' }, VueSlot(slots.default)),
		)
	}
);
