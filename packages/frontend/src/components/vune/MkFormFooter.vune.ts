/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, HStack, Text } from 'vune-ui';
import MkButton from '@/components/MkButton.vue';
import type { useForm } from '@/composables/use-form.js';
import { i18n } from '@/i18n.js';
import { createVuneComponent, VueComponent, vuneBoolean } from '@/vune/vue.js';
import './misskey-vune.scss';

type Props = {
	form: ReturnType<typeof useForm>;
	canSaving?: boolean;
};

export default createVuneComponent<Props>((props) => {
	const form = props.form;
	if (!form?.modified.value) return null;
	const canSaving = vuneBoolean(props.canSaving, true);

	return HStack(alignment: 'center', spacing: 8) {
		Text(i18n.tsx.thereAreNChanges({ n: form.modifiedCount.value })).className('mk-vune-form-footer__text')
		Element('div', { className: '_buttons mk-vune-form-footer__buttons' },
			VueComponent(MkButton, { danger: true, rounded: true, onClick: form.discard }, {
				default: () => Element('span', null, Element('i', { className: 'ti ti-x' }), Text(` ${i18n.ts.discard}`)),
			}),
			VueComponent(MkButton, { primary: true, rounded: true, disabled: !canSaving, onClick: form.save }, {
				default: () => Element('span', null, Element('i', { className: 'ti ti-check' }), Text(` ${i18n.ts.save}`)),
			}),
		)
	}
		.style({ justifyContent: 'flex-start' })
		.className('mk-vune-form-footer');
});
