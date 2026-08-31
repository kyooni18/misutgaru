<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<VuneDonation :zIndex="zIndex" :onClose="close" :onNeverShow="neverShow"/>
</template>

<script lang="ts" setup>
import VuneDonation from './vune/MkDonation.vune?vue-host';
import * as os from '@/os.js';
import { miLocalStorage } from '@/local-storage.js';

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

const zIndex = os.claimZIndex('low');

function close() {
	miLocalStorage.setItem('latestDonationInfoShownAt', Date.now().toString());
	emit('closed');
}

function neverShow() {
	miLocalStorage.setItem('neverShowDonationInfo', 'true');
	close();
}
</script>
