/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, ForEach, Group } from 'vune-ui';
import type * as Misskey from 'misskey-js';
import MkRolePreview from '@/components/MkRolePreview.vue';
import MkLoading from '@/components/global/MkLoading.vue';
import MkResult from '@/components/global/MkResult.vue';
import { i18n } from '@/i18n.js';
import { createVuneComponent, VueComponent, vuneBoolean } from '@/vune/vue.js';

type Props = { roles?: Misskey.entities.Role[] | null; loading?: boolean };
export default createVuneComponent<Props>((props) =>
	Element('div', { className: '_spacer', style: { '--MI_SPACER-w': '700px' } },
		props.roles != null && props.roles.length > 0
			? Group() {
				ForEach(props.roles, key: (role: Misskey.entities.Role) => role.id) { role in
					VueComponent(MkRolePreview, { role: role, forModeration: false })
				}
			}.className('_gaps_s')
			: vuneBoolean(props.loading)
				? VueComponent(MkLoading)
				: VueComponent(MkResult, { type: 'empty', text: i18n.ts.noRole }),
	)
);
