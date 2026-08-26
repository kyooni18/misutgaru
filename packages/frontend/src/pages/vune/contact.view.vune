/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Group, Text } from 'vune-ui';
import PageWithHeader from '@/components/global/PageWithHeader.vue';
import MkKeyValue from '@/components/MkKeyValue.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkLink from '@/components/MkLink.vue';
import MkCode from '@/components/MkCode.vue';
import MkLoading from '@/components/global/MkLoading.vue';
import type { UserEnvironment } from '@/utility/get-user-environment.js';
import { instance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { userEnv?: UserEnvironment | null; onOpened?: () => void };
const empty = () => Element('span', { style: { opacity: '0.7' } }, Text(`(${i18n.ts.none})`));

export default createVuneComponent<Props>((props) =>
	VueComponent(PageWithHeader, {}, {
		default: () => Element('div', { className: '_spacer', style: { '--MI_SPACER-w': '600px', '--MI_SPACER-min': '20px' } },
			Group() {
				VueComponent(MkKeyValue, { copy: instance.maintainerName }, {
					key: () => Text(i18n.ts.administrator),
					value: () => instance.maintainerName ? Text(instance.maintainerName) : empty(),
				})
				VueComponent(MkKeyValue, { copy: instance.maintainerEmail }, {
					key: () => Text(i18n.ts.contact),
					value: () => instance.maintainerEmail ? Text(instance.maintainerEmail) : empty(),
				})
				VueComponent(MkKeyValue, { copy: instance.inquiryUrl }, {
					key: () => Text(i18n.ts.inquiry),
					value: () => instance.inquiryUrl
						? VueComponent(MkLink, { url: instance.inquiryUrl, target: '_blank' }, { default: () => Text(instance.inquiryUrl) })
						: empty(),
				})
				VueComponent(MkFolder, { onOpened: () => props.onOpened?.() }, {
					icon: () => Element('i', { className: 'ti ti-report-search' }),
					label: () => Text(i18n.ts.deviceInfo),
					caption: () => Text(i18n.ts.deviceInfoDescription),
					default: () => props.userEnv == null
						? VueComponent(MkLoading)
						: VueComponent(MkCode, { lang: 'json', code: JSON.stringify(props.userEnv, null, 2), style: { maxHeight: '300px', overflow: 'auto' } }),
				})
			}.className('_gaps_m'),
		),
	})
);
