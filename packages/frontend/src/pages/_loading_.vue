<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<script lang="ts">
import LoadingPage from './vune/_loading_.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';

export default createVuneWebHost(LoadingPage);
</script>
