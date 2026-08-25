/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Group } from 'vune-ui';
import MkTooltip from '@/components/MkTooltip.vue';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';
import '../../vune/misskey-vune.scss';

type Props = {
	showing: boolean;
	content: string;
	anchorElement: HTMLElement;
	onClosed?: () => void;
};

export default createVuneComponent<Props>((props) =>
	Group() {
		VueComponent(MkTooltip, {
			showing: props.showing,
			anchorElement: props.anchorElement,
			maxWidth: 250,
			onClosed: () => props.onClosed?.(),
		}, {
			default: () => Element('div', { className: 'mk-vune-grid-cell-tooltip' }, props.content ?? ''),
		})
	}
);
