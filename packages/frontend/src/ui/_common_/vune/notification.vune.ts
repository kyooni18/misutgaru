/* SPDX-License-Identifier: AGPL-3.0-only */
import { Group } from 'vune-ui';
import type * as Misskey from 'misskey-js';
import XNotification from '@/components/MkNotification.vue';
import MaterialSurface from '@/vune/MaterialSurface.vune.js';
import { Material } from '@/vune/material.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';
import '@/vune/phase5-migration.scss';

type Props = { notification: Misskey.entities.Notification };
export default createVuneComponent<Props>((props) =>
	Group() {
		MaterialSurface(Material.regular) {
			VueComponent(XNotification, {
				notification: props.notification,
				full: false,
				class: 'notification',
			})
		}
	}.className('mk-vune-notification-shell')
);
