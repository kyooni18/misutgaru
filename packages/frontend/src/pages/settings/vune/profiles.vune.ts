/* SPDX-License-Identifier: AGPL-3.0-only */
import { ForEach, Group, Text } from 'vune-ui';
import SearchMarker from '@/components/global/SearchMarker.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Backup = { name: string };
type Props = { backups: Backup[]; onDelete?: (backup: Backup) => void };
export default createVuneComponent<Props>((props) =>
	VueComponent(SearchMarker, { path: '/settings/profiles', label: i18n.ts._preferencesProfile.manageProfiles, keywords: ['profile', 'settings', 'preferences', 'manage'], icon: 'ti ti-settings-cog' }, {
		default: () => Group() {
			ForEach(props.backups ?? [], key: (backup: Backup) => backup.name) { backup in
				VueComponent(MkFolder, {}, {
					label: () => Text(backup.name),
					default: () => VueComponent(MkButton, { danger: true, onClick: () => props.onDelete?.(backup) }, { default: () => Text(i18n.ts.delete) }),
				})
			}
		}.className('_gaps'),
	})
);
