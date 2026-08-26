/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, ForEach, Group, Text } from 'vune-ui';
import type * as Misskey from 'misskey-js';
import MkFolder from '@/components/MkFolder.vue';
import MkButton from '@/components/MkButton.vue';
import MkAvatar from '@/components/global/MkAvatar.vue';
import MkUserName from '@/components/global/MkUserName.vue';
import MkTime from '@/components/global/MkTime.vue';
import MkResult from '@/components/global/MkResult.vue';
import MkLoading from '@/components/global/MkLoading.vue';
import { i18n } from '@/i18n.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Invitation = Misskey.entities.ChatRoomInvitation;
type Props = { fetching: boolean; invitations: Invitation[]; bodyClass?: string; avatarClass?: string; onJoin?: (invitation: Invitation) => void; onIgnore?: (invitation: Invitation) => void };
export default createVuneComponent<Props>((props) =>
	Group() {
		if (props.invitations.length > 0) {
			Group() {
				ForEach(props.invitations, key: (invitation: Invitation) => invitation.id) { invitation in
					VueComponent(MkFolder, { defaultOpen: true }, {
						icon: () => Element('i', { className: 'ti ti-users-group' }),
						label: () => Text(invitation.room.name ?? ''),
						suffix: () => VueComponent(MkTime, { time: invitation.createdAt }),
						footer: () => Element('div', { className: '_buttons' },
							VueComponent(MkButton, { primary: true, onClick: () => props.onJoin?.(invitation) }, { default: () => Group() { Element('i', { className: 'ti ti-plus' }); Text(` ${i18n.ts._chat.join}`) } }),
							VueComponent(MkButton, { danger: true, onClick: () => props.onIgnore?.(invitation) }, { default: () => Group() { Element('i', { className: 'ti ti-x' }); Text(` ${i18n.ts._chat.ignore}`) } }),
						),
						default: () => Group() {
							VueComponent(MkAvatar, { user: invitation.room.owner, class: props.avatarClass, link: true })
							Group() {
								VueComponent(MkUserName, { user: invitation.room.owner })
								Element('hr')
								Element('div', {}, invitation.room.description === '' ? i18n.ts.noDescription : invitation.room.description)
							}.style({ flex: '1' }).className('_gaps_s')
						}.className(props.bodyClass),
					})
				}
			}.className('_gaps_s')
		}
		if (!props.fetching && props.invitations.length === 0) { VueComponent(MkResult, { type: 'empty', text: i18n.ts._chat.noInvitations }) }
		if (props.fetching) { VueComponent(MkLoading) }
	}.className('_gaps')
);
