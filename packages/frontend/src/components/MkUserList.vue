<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import MkUserList from './vune/MkUserList.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
export default createVuneWebHost(MkUserList, { deepProps: ['paginator'] });
</script>
