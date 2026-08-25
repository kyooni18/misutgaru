<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import MkLoading from './vune/MkLoading.vune.js';
import { createVuneWebHost } from '@/vune/compat-vue.js';
export default createVuneWebHost(MkLoading, { aliases: { isStatic: 'static' } });
</script>
