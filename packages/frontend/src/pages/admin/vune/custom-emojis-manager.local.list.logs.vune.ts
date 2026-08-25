/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Group, Text } from 'vune-ui';
import MkWindow from '@/components/MkWindow.vue';
import XRegisterLogs from '@/pages/admin/custom-emojis-manager.logs.vue';
import { i18n } from '@/i18n.js';
import type { RequestLogItem } from '@/pages/admin/custom-emojis-manager.impl.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = {
	logs: RequestLogItem[];
	onClosed?: () => void;
};

export default createVuneComponent<Props>((props) =>
	Group() {
		VueComponent(MkWindow, {
			initialWidth: 400,
			initialHeight: 500,
			canResize: true,
			onClosed: () => props.onClosed?.(),
		}, {
			header: () => Group() {
				Element('i', { className: 'ti ti-notes', style: { marginRight: '0.5em' } })
				Text(i18n.ts._customEmojisManager._gridCommon.registrationLogs)
			},
			default: () => Element('div', { className: '_spacer' },
				VueComponent(XRegisterLogs, { logs: props.logs }),
			),
		})
	}
);
