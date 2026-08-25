/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, ForEach, Group, Text } from 'vune-ui';
import type * as Misskey from 'misskey-js';
import MkContainer from '@/components/MkContainer.vue';
import MkLoading from '@/components/global/MkLoading.vue';
import MkNoteMediaGrid from '@/components/MkNoteMediaGrid.vue';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { fetching: boolean; notes: Misskey.entities.Note[]; rootClass?: string; streamClass?: string; onShowMore?: () => void };
export default createVuneComponent<Props>((props) =>
	VueComponent(MkContainer, {}, {
		icon: () => Element('i', { className: 'ti ti-photo' }),
		header: () => Text(i18n.ts.files),
		default: () => Group() {
			if (props.fetching) { VueComponent(MkLoading) }
			if (!props.fetching && props.notes.length > 0) {
				Group() {
					Group() {
						ForEach(props.notes, key: (note: Misskey.entities.Note) => note.id) { note in
							VueComponent(MkNoteMediaGrid, { note })
						}
					}.className(props.streamClass)
					VueComponent(MkButton, { rounded: true, full: true, onClick: () => props.onShowMore?.() }, {
						default: () => Group() { Text(`${i18n.ts.showMore} `); Element('i', { className: 'ti ti-arrow-right' }) },
					})
				}.className('_gaps_s')
			}
			if (!props.fetching && props.notes.length === 0) { Element('p', {}, i18n.ts.nothing) }
		}.className(props.rootClass),
	})
);
