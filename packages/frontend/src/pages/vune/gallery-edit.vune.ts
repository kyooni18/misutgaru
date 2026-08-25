/* SPDX-License-Identifier: AGPL-3.0-only */
import MkSuspense from '@/components/global/MkSuspense.vue';
import XRoot from '@/pages/gallery/edit.root.vue';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { fetcher: () => Promise<unknown> };
export default createVuneComponent<Props>((props) =>
	VueComponent(MkSuspense, { p: props.fetcher }, {
		default: (slotProps: any) => VueComponent(XRoot, { post: slotProps.result }),
	})
);
