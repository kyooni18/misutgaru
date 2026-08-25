/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Text } from 'vune-ui';
import MkContainer from '@/components/MkContainer.vue';
import MkChatHistories from '@/components/MkChatHistories.vue';
import { i18n } from '@/i18n.js';
import { createVuneComponent, VueComponent, vuneBoolean } from '@/vune/vue.js';

type Props = { showHeader?: boolean; onConfigure?: () => void };
export default createVuneComponent<Props>((props) =>
	VueComponent(MkContainer, { showHeader: vuneBoolean(props.showHeader, true), class: 'mkw-chat' }, {
		icon: () => Element('i', { className: 'ti ti-users' }),
		header: () => Text(i18n.ts._widgets.chat),
		func: (slotProps: any) => Element('button', {
			className: ['_button', slotProps.buttonStyleClass],
			onClick: () => props.onConfigure?.(),
		}, Element('i', { className: 'ti ti-settings' })),
		default: () => Element('div', {}, VueComponent(MkChatHistories)),
	})
);
