/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, HStack } from 'vune-ui';
import { createVuneComponent, VueSlot, vuneBoolean } from '@/vune/vue.js';
import './misskey-vune.scss';

type Props = {
	warn?: boolean;
	closable?: boolean;
	onClose?: () => void;
};

export default createVuneComponent<Props>((props, slots) =>
	HStack(alignment: 'center', spacing: 0) {
		Element('i', {
			className: `${vuneBoolean(props.warn) ? 'ti ti-alert-triangle' : 'ti ti-info-circle'} mk-vune-info__icon`,
		})
		Element('div', { className: 'mk-vune-info__content' }, VueSlot(slots.default))
		if (vuneBoolean(props.closable)) {
			Element('button', {
				className: '_button mk-vune-info__close',
				type: 'button',
				onClick: () => props.onClose?.(),
			}, Element('i', { className: 'ti ti-x' }))
		}
	}
		.style({ justifyContent: 'flex-start' })
		.className(['_selectable', 'mk-vune-info', vuneBoolean(props.warn) ? 'mk-vune-info--warn' : null])
);
