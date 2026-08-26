/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Text } from 'vune-ui';
import MkContainer from '@/components/MkContainer.vue';
import MkClickerGame from '@/components/MkClickerGame.vue';
import { createVuneComponent, VueComponent, vuneBoolean } from '@/vune/vue.js';

type Props = { showHeader?: boolean };
export default createVuneComponent<Props>((props) =>
	VueComponent(MkContainer, { showHeader: vuneBoolean(props.showHeader), class: 'mkw-clicker' }, {
		icon: () => Element('i', { className: 'ti ti-cookie' }),
		header: () => Text('Clicker'),
		default: () => VueComponent(MkClickerGame),
	})
);
