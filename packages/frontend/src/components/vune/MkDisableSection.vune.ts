/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Group } from 'vune-ui';
import { createVuneComponent, VueSlot, vuneBoolean } from '@/vune/vue.js';
import './misskey-vune.scss';

type Props = { disabled?: boolean };

export default createVuneComponent<Props>((props, slots) =>
	Group() {
		Element('div', { className: 'mk-vune-disable-section' },
			Element('div', {
				className: vuneBoolean(props.disabled) ? 'mk-vune-disable-section__content--disabled' : '',
			}, VueSlot(slots.default)).withProps({
				inert: vuneBoolean(props.disabled) ? true : undefined,
			}),
			vuneBoolean(props.disabled) ? Element('div', { className: 'mk-vune-disable-section__cover' }) : null,
		)
	}
);
