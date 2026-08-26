/* SPDX-License-Identifier: AGPL-3.0-only */
import { Text } from 'vune-ui';
import type * as Misskey from 'misskey-js';
import MkDrive from '@/components/MkDrive.vue';
import MkWindow from '@/components/MkWindow.vue';
import { i18n } from '@/i18n.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

type Props = { initialFolder?: Misskey.entities.DriveFolder | null; onClosed?: () => void };
export default createVuneComponent<Props>((props) =>
	VueComponent(MkWindow, { canResize: true, onClosed: () => props.onClosed?.() }, {
		header: () => Text(i18n.ts.drive),
		default: () => VueComponent(MkDrive, { initialFolder: props.initialFolder ?? null }),
	})
);
