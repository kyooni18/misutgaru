/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, Group, Text } from 'vune-ui';
import type { entities } from 'misskey-js';
import MkFolder from '@/components/MkFolder.vue';
import MkButton from '@/components/MkButton.vue';
import MkKeyValue from '@/components/MkKeyValue.vue';
import MkTime from '@/components/global/MkTime.vue';
import { i18n } from '@/i18n.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { entity: entities.SystemWebhook; onEdit?: () => void; onDelete?: () => void };
function statusIcon(entity: entities.SystemWebhook) {
	if (!entity.isActive) return Element('i', { className: 'ti ti-player-pause' });
	if (entity.latestStatus === null) return Element('i', { className: 'ti ti-circle' });
	if ([200, 201, 204].includes(entity.latestStatus)) return Element('i', { className: 'ti ti-check', style: { color: 'var(--MI_THEME-success)' } });
	return Element('i', { className: 'ti ti-alert-triangle', style: { color: 'var(--MI_THEME-error)' } });
}
export default createVuneComponent<Props>((props) => {
	const entity = props.entity;
	return VueComponent(MkFolder, {}, {
		label: () => Text(entity.name || entity.url),
		caption: () => entity.name != null && entity.name !== '' ? Text(entity.url) : Group() {},
		icon: () => statusIcon(entity),
		suffix: () => entity.latestSentAt ? VueComponent(MkTime, { time: entity.latestSentAt, style: { marginRight: '8px' } }) : Text('-'),
		footer: () => Element('div', { className: '_buttons' },
			VueComponent(MkButton, { onClick: () => props.onEdit?.() }, { default: () => Group() { Element('i', { className: 'ti ti-settings' }); Text(` ${i18n.ts.edit}`) } }),
			VueComponent(MkButton, { danger: true, onClick: () => props.onDelete?.() }, { default: () => Group() { Element('i', { className: 'ti ti-trash' }); Text(` ${i18n.ts.delete}`) } }),
		),
		default: () => Element('div', { className: '_gaps' },
			VueComponent(MkKeyValue, {}, {
				key: () => Text('latestStatus'),
				value: () => Text(String(entity.latestStatus ?? '-')),
			}),
		),
	});
});
