/* SPDX-License-Identifier: AGPL-3.0-only */
import PageWithHeader from '@/components/global/PageWithHeader.vue';
import MkAntennaEditor from '@/components/MkAntennaEditor.vue';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { onCreated?: () => void };
export default createVuneComponent<Props>((props) =>
	VueComponent(PageWithHeader, { actions: [], tabs: [] }, {
		default: () => VueComponent(MkAntennaEditor, { onCreated: () => props.onCreated?.() }),
	})
);
