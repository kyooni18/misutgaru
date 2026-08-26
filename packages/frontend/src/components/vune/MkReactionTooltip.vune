/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Group } from 'vune-ui';
import MkTooltip from '@/components/MkTooltip.vue';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';
import '@/vune/phase5-migration.scss';

type Props = { showing: boolean; reaction: string; anchorElement: HTMLElement; onClosed?: () => void };
export default createVuneComponent<Props>((props) =>
	VueComponent(MkTooltip, { showing: props.showing, anchorElement: props.anchorElement, maxWidth: 340, onClosed: () => props.onClosed?.() }, {
		default: () => Group() {
			VueComponent(MkReactionIcon, { reaction: props.reaction, class: 'mk-vune-reaction-tooltip__icon', noStyle: true })
			Element('div', { className: 'mk-vune-reaction-tooltip__name' }, props.reaction.replace('@.', ''))
		}.className('mk-vune-reaction-tooltip'),
	})
);
