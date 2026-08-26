<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<script lang="ts">
import { unref } from 'vue';
import MkSwitchButton from './vune/MkSwitchButton.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';

function coerceBoolean(value: unknown) {
	const raw = unref(value as any);
	return raw !== false && raw !== 'false' && raw != null;
}

export default createVuneWebHost(MkSwitchButton, {
	coerce: {
		checked: coerceBoolean,
		disabled: coerceBoolean,
	},
});
</script>
