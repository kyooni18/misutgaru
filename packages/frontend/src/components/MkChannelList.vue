<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import MkChannelList from './vune/MkChannelList.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
export default createVuneWebHost(MkChannelList, { deepProps: ['paginator'] });
</script>
