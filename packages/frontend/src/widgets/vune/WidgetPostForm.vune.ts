/* SPDX-License-Identifier: AGPL-3.0-only */
import MkPostForm from '@/components/MkPostForm.vue';
import { createVuneComponent, VueComponent } from '@/vune/vue.js';

export default createVuneComponent(() =>
	VueComponent(MkPostForm, {
		'data-testid': 'mkw-postForm',
		class: '_panel mkw-post-form',
		fixed: true,
		autofocus: false,
	})
);
