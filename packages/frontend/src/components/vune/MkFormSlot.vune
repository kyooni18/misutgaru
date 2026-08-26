/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Group } from 'vune-ui';
import { createVuneComponent, VueSlot } from '@/vune/vue.js';
import './misskey-vune.scss';

export default createVuneComponent((_props, slots) =>
	Group() {
		Element('div', null,
			Element('div', { className: 'mk-vune-form-slot__label' }, VueSlot(slots.label)),
			Element('div', null, VueSlot(slots.default)),
			Element('div', { className: 'mk-vune-form-slot__caption' }, VueSlot(slots.caption)),
		)
	}
);
