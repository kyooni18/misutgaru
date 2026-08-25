/* SPDX-License-Identifier: AGPL-3.0-only */
import { defineAsyncComponent } from 'vue';
import { ForEach, Group, Text } from 'vune-ui';
import { instance } from '@/instance.js';
import { prefer } from '@/preferences.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';
import '@/vune/phase5-migration.scss';

const XRss = defineAsyncComponent(() => import('../statusbar-rss.vue'));
const XFederation = defineAsyncComponent(() => import('../statusbar-federation.vue'));
const XUserList = defineAsyncComponent(() => import('../statusbar-user-list.vue'));
function classes(x: any) { return ['mk-vune-statusbar', x.black ? 'mk-vune-statusbar--black' : '', x.size ? `mk-vune-statusbar--${x.size}` : '']; }
function common(x: any) { return { class: 'mk-vune-statusbar__body', refreshIntervalSec: x.props.refreshIntervalSec, marqueeDuration: x.props.marqueeDuration, marqueeReverse: x.props.marqueeReverse, display: x.props.display }; }
export default createVuneComponent(() =>
	Group() {
		ForEach(prefer.r.statusbars.value, key: (x: any) => x.id) { x in
			Group() {
				Text(x.name ?? '').className('mk-vune-statusbar__name')
				if (x.type === 'rss') { VueComponent(XRss, { ...common(x), url: x.props.url, shuffle: x.props.shuffle }) }
				if (x.type === 'federation' && instance.federation !== 'none') { VueComponent(XFederation, { ...common(x), colored: x.props.colored }) }
				if (x.type === 'userList') { VueComponent(XUserList, { ...common(x), userListId: x.props.userListId }) }
			}.className(classes(x))
		}
	}.className('mk-vune-statusbars')
);
