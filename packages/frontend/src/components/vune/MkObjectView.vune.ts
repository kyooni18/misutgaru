/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Group } from 'vune-ui';
import XValue from '@/components/MkObjectView.value.vue';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = {
	value: Record<string, unknown>;
};

export default createVuneComponent<Props>((props) =>
	Group() {
		Element('div', { className: '_selectable' },
			VueComponent(XValue, { value: props.value, collapsed: false }),
		)
	}
);
