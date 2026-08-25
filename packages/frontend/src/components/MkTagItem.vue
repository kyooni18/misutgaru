<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import MkTagItem from './vune/MkTagItem.vune.js';
import { createVuneWebHost } from '@/vune/compat-vue.js';
export default createVuneWebHost(MkTagItem, {
	aliases: {
		icon: 'iconClass',
		extraIcon: 'exButtonIconClass',
		onExtra: 'onExButtonClick',
	},
});
</script>
