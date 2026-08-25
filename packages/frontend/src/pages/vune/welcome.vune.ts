/* SPDX-License-Identifier: AGPL-3.0-only */
import { Group } from 'vune-ui';
import type * as Misskey from 'misskey-js';
import XSetup from '../welcome.setup.vue';
import XEntranceClassic from '../welcome.entrance.classic.vue';
import XEntranceSimple from '../welcome.entrance.simple.vue';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { instance: Misskey.entities.MetaDetailed | null };
export default createVuneComponent<Props>((props) => {
	if (!props.instance) return Group() {};
	if (props.instance.requireSetup) return VueComponent(XSetup);
	if ((props.instance.clientOptions.entrancePageStyle ?? 'classic') === 'classic') return VueComponent(XEntranceClassic);
	return VueComponent(XEntranceSimple);
});
