/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Group, HStack, Text } from 'vune-ui';
import type * as Misskey from 'misskey-js';
import MkA from '@/components/global/MkA.vue';
import MkAvatar from '@/components/global/MkAvatar.vue';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';
import '@/vune/phase5-migration.scss';

type Props = { room: Misskey.entities.ChatRoom };
export default createVuneComponent<Props>((props) =>
	VueComponent(MkA, { to: `/chat/room/${props.room.id}`, class: '_panel _gaps_s mk-vune-room' }, {
		default: () => Group() {
			HStack(alignment: 'center', spacing: 0) {
				Element('div', { style: { fontWeight: 'bold' } }, props.room.name)
				VueComponent(MkAvatar, { user: props.room.owner, link: false, class: 'mk-vune-room__avatar' })
			}.className('mk-vune-room__header')
			Element('hr')
			Text(props.room.description ?? '')
		},
	})
);
