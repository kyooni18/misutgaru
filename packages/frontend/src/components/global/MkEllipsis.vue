<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import MkEllipsis from '../vune/MkEllipsis.vune.js';
import { createVuneWebHost } from '@/vune/compat-vue.js';
export default createVuneWebHost(MkEllipsis, { aliases: { isStatic: 'static' } });
</script>
