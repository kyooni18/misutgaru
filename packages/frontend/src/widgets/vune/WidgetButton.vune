/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Text } from 'vune-ui';
import MkButton from '@/components/MkButton.vue';
import { createVuneComponent, VueComponent, vuneBoolean } from '@/vune/vue.js';

type Props = { label?: string; colored?: boolean; onRun?: () => void };
export default createVuneComponent<Props>((props) =>
	Element('div', { 'data-testid': 'mkw-button', className: 'mkw-button' },
		VueComponent(MkButton, {
			primary: vuneBoolean(props.colored, true),
			full: true,
			onClick: () => props.onRun?.(),
		}, { default: () => Text(props.label ?? '') }),
	)
);
