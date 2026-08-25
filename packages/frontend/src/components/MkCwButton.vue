<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import MkCwButton from './vune/MkCwButton.vune.js';
import { createVuneWebHost } from '@/vune/compat-vue.js';
export default createVuneWebHost(MkCwButton, {
	aliases: { onChange: 'onUpdate:modelValue' },
});
</script>
