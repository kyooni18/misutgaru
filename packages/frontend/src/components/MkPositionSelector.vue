<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import MkPositionSelector from './vune/MkPositionSelector.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
export default createVuneWebHost(MkPositionSelector, {
	aliases: {
		onUpdateX: 'onUpdate:x',
		onUpdateY: 'onUpdate:y',
	},
});
</script>
