/* SPDX-License-Identifier: AGPL-3.0-only */
import { Group, Text } from 'vune-ui';
import MkInfo from '@/components/MkInfo.vue';
import MkNotesTimeline from '@/components/MkNotesTimeline.vue';
import type { IPaginator } from '@/utility/paginator.js';
import { i18n } from '@/i18n.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { paginator: IPaginator };
export default createVuneComponent<Props>((props) => Group() {
	VueComponent(MkInfo, {}, { default: () => Text(i18n.ts._fileViewer.thisPageCanBeSeenFromTheAuthor) })
	VueComponent(MkNotesTimeline, { paginator: props.paginator })
}.className('_gaps'));
