/* SPDX-License-Identifier: AGPL-3.0-only */
import { ForEach, Group } from 'vune-ui';
import type * as Misskey from 'misskey-js';
import XRoom from '../XRoom.vue';
import MkResult from '@/components/global/MkResult.vue';
import MkLoading from '@/components/global/MkLoading.vue';
import { i18n } from '@/i18n.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { fetching: boolean; rooms: Misskey.entities.ChatRoom[] };
export default createVuneComponent<Props>((props) =>
	Group() {
		if (props.rooms.length > 0) {
			Group() {
				ForEach(props.rooms, key: (room: Misskey.entities.ChatRoom) => room.id) { room in VueComponent(XRoom, { room }) }
			}.className('_gaps_s')
		}
		if (!props.fetching && props.rooms.length === 0) { VueComponent(MkResult, { type: 'empty', text: i18n.ts._chat.noRooms }) }
		if (props.fetching) { VueComponent(MkLoading) }
	}.className('_gaps')
);
