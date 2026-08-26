<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import MkTab from './vune/MkTab.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
export type { Tab } from './vune/MkTab.types.js';
export default createVuneWebHost(MkTab, {
	aliases: {
		selection: 'modelValue',
		onSelect: 'onUpdate:modelValue',
	},
});
</script>
