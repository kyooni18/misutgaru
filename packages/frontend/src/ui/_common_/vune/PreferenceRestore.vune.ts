/* SPDX-License-Identifier: AGPL-3.0-only */
/* @misutgaru-vune-native */
import { Button, HStack, Text } from 'vune-ui';
import VuneIcon from '@/vune/Icon.vune.js';
import { i18n } from '@/i18n.js';
import { hideRestoreBackupSuggestion, restoreFromCloudBackup } from '@/preferences/utility.js';
import '@/vune/phase5-migration.scss';

export struct PreferenceRestore: View {
	var body: some View {
		HStack(alignment: 'center', spacing: 0) {
			VuneIcon('ti ti-info-circle').className('mk-vune-bar__icon')
			Text(i18n.ts._preferencesBackup.backupFound).className('mk-vune-bar__title')
			HStack(alignment: 'center', spacing: 4) {
				Button(i18n.ts.restore) { restoreFromCloudBackup() }.className(['_textButton','mk-vune-bar__button'])
				Text('|')
				Button(i18n.ts.skip) { hideRestoreBackupSuggestion() }.className(['_textButton','mk-vune-bar__button'])
			}.className('mk-vune-bar__body')
		}.className(['mk-vune-bar','mk-vune-bar--panel'])
	}
}
export default PreferenceRestore
