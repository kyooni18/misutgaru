/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Group, Text } from 'vune-ui';
import type * as Misskey from 'misskey-js';
import MkMention from '@/components/MkMention.vue';
import { i18n } from '@/i18n.js';
import { host as localHost } from '@@/js/config.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { user?: Misskey.entities.UserLite; rootClass?: string; linkClass?: string };
export default createVuneComponent<Props>((props) => {
	if (!props.user) return Group() {};
	return Group() {
		Element('i', { className: 'ti ti-plane-departure', style: { marginRight: '8px' } })
		Text(i18n.ts.accountMoved)
		VueComponent(MkMention, { class: props.linkClass, username: props.user.username, host: props.user.host ?? localHost })
	}.className(props.rootClass);
});
