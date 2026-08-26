<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<script lang="ts">
import MkMediaRange from './vune/MkMediaRange.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';

export default createVuneWebHost(MkMediaRange, {
	aliases: {
		onChange: 'onUpdate:modelValue',
		onDragEnded: 'onDragEnded',
	},
});
</script>
