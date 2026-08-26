/* SPDX-License-Identifier: AGPL-3.0-only */
import MkSuspense from '@/components/global/MkSuspense.vue';
import XRoot from '@/pages/admin-file.root.vue';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { fetcher: () => Promise<any>; onResolved?: (result: any) => void };
export default createVuneComponent<Props>((props) =>
	VueComponent(MkSuspense, { p: props.fetcher, onResolved: (result: any) => props.onResolved?.(result) }, {
		default: (slotProps: any) => slotProps.result?.file != null && slotProps.result?.info != null
			? VueComponent(XRoot, { file: slotProps.result.file, info: slotProps.result.info })
			: null,
	})
);
