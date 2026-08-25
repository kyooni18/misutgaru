/* SPDX-License-Identifier: AGPL-3.0-only */
import { Group } from 'vune-ui';
import type * as Misskey from 'misskey-js';
import MkNote from '@/components/MkNote.vue';
import MkNoteDetailed from '@/components/MkNoteDetailed.vue';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = {
	block: Extract<Misskey.entities.PageBlock, { type: 'note' }>;
	note: Misskey.entities.Note | null;
	rootClass?: string;
};

export default createVuneComponent<Props>((props) =>
	Group() {
		if (props.note && !props.block.detailed) { VueComponent(MkNote, { key: `${props.note.id}:normal`, note: props.note }) }
		if (props.note && props.block.detailed) { VueComponent(MkNoteDetailed, { key: `${props.note.id}:detail`, note: props.note }) }
	}.className(props.rootClass)
);
