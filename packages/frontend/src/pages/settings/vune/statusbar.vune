/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, ForEach, Group, Text } from 'vune-ui';
import type * as Misskey from 'misskey-js';
import XStatusbar from '../statusbar.statusbar.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Statusbar = { id: string; type: string | null; name: string | null };
type Props = { statusbars: Statusbar[]; userLists: Misskey.entities.UserList[] | null; onAdd?: () => void };
export default createVuneComponent<Props>((props) =>
	Group() {
		ForEach(props.statusbars ?? [], key: (x: Statusbar) => x.id) { x in
			VueComponent(MkFolder, {}, {
				label: () => Text(x.type ?? i18n.ts.notSet),
				suffix: () => Text(x.name ?? ''),
				default: () => VueComponent(XStatusbar, { _id: x.id, userLists: props.userLists }),
			})
		}
		VueComponent(MkButton, { primary: true, onClick: () => props.onAdd?.() }, { default: () => Text(i18n.ts.add) })
	}.className('_gaps_m')
);
