/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Group, Text } from 'vune-ui';
import { ensureSignin } from '@/i.js';
import { i18n } from '@/i18n.js';
import XColumn from '../column.vue';
import type { Column } from '@/deck.js';
import MkInfo from '@/components/MkInfo.vue';
import MkChatHistories from '@/components/MkChatHistories.vue';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';
import '@/vune/phase5-migration.scss';

type Props = { column: Column; isStacked: boolean };
export default createVuneComponent<Props>((props) => {
	const me = ensureSignin();
	const availability = me.policies.chatAvailability;
	return VueComponent(XColumn, { column: props.column, isStacked: props.isStacked }, {
		header: () => Group() { Element('i', { className: 'ti ti-messages', style: { marginRight: '8px' } }); Text(props.column.name || i18n.ts._deck._columns.chat) },
		default: () => Group() {
			if (availability === 'readonly') { VueComponent(MkInfo, {}, { default: () => Text(i18n.ts._chat.chatIsReadOnlyForThisAccountOrServer) }) }
			if (availability === 'unavailable') { VueComponent(MkInfo, { warn: true }, { default: () => Text(i18n.ts._chat.chatNotAvailableForThisAccountOrServer) }) }
			if (availability !== 'unavailable') { VueComponent(MkChatHistories) }
		}.className(['_gaps', 'mk-vune-deck-body']),
	});
});
