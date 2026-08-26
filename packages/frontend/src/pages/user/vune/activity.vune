/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Group, Text } from 'vune-ui';
import type * as Misskey from 'misskey-js';
import XPv from '../activity.pv.vue';
import XNotes from '../activity.notes.vue';
import XFollowing from '../activity.following.vue';
import MkFoldableSection from '@/components/MkFoldableSection.vue';
import MkHeatmap from '@/components/MkHeatmap.vue';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

function header(icon: string, label: string) { return Group() { Element('i', { className: icon }); Text(' ' + label) }; }
type Props = { user: Misskey.entities.User };
export default createVuneComponent<Props>((props) =>
	Element('div', { className: '_spacer', style: { '--MI_SPACER-w': '700px' } },
		Group() {
			VueComponent(MkFoldableSection, { class: 'item' }, { header: () => header('ti ti-activity', 'Heatmap'), default: () => VueComponent(MkHeatmap, { user: props.user, src: 'notes' }) })
			VueComponent(MkFoldableSection, { class: 'item' }, { header: () => header('ti ti-pencil', 'Notes'), default: () => VueComponent(XNotes, { user: props.user }) })
			VueComponent(MkFoldableSection, { class: 'item' }, { header: () => header('ti ti-users', 'Following'), default: () => VueComponent(XFollowing, { user: props.user }) })
			VueComponent(MkFoldableSection, { class: 'item' }, { header: () => header('ti ti-eye', 'PV'), default: () => VueComponent(XPv, { user: props.user }) })
		}.className('_gaps'),
	)
);
