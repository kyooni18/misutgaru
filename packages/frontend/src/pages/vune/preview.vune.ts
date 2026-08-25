/* SPDX-License-Identifier: AGPL-3.0-only */
import { Group } from 'vune-ui';
import MkPreview from '@/components/MkPreview.vue';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

definePage(() => ({ title: i18n.ts.preview, icon: 'ti ti-eye' }));
export default createVuneComponent(() => Group() { VueComponent(MkPreview) });
