/* SPDX-License-Identifier: AGPL-3.0-only */
import { Element, ForEach, Group } from 'vune-ui';
import MkA from '@/components/global/MkA.vue';
import { $i } from '@/i.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';
import '@/vune/phase5-migration.scss';

function iconClass(icon: string) {
	if (icon === 'warning') return 'ti ti-alert-triangle';
	if (icon === 'error') return 'ti ti-circle-x';
	if (icon === 'success') return 'ti ti-check';
	return 'ti ti-info-circle';
}
function iconStyle(icon: string) {
	if (icon === 'warning') return { color: 'var(--MI_THEME-warn)' };
	if (icon === 'error') return { color: 'var(--MI_THEME-error)' };
	if (icon === 'success') return { color: 'var(--MI_THEME-success)' };
	return {};
}
export default createVuneComponent(() => {
	if (!$i) return Group() {};
	const announcements = $i.unreadAnnouncements.filter(x => x.display === 'banner');
	return Group() {
		ForEach(announcements, key: (announcement: any) => announcement.id) { announcement in
			VueComponent(MkA, { to: `/announcements/${announcement.id}`, class: 'mk-vune-announcement' }, {
				default: () => Group() {
					Element('span', { className: 'mk-vune-announcement__icon' }, Element('i', { className: iconClass(announcement.icon), style: iconStyle(announcement.icon) }))
					Element('span', { className: 'mk-vune-announcement__title' }, announcement.title)
					Element('span', { className: 'mk-vune-announcement__body' }, announcement.text)
				},
			})
		}
	}.className('mk-vune-announcements');
});
