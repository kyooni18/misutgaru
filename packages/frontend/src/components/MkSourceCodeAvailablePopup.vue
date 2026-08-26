<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<VuneSourceCodeAvailablePopup :zIndex="zIndex" :onClose="close"/>
</template>

<script lang="ts" setup>
import VuneSourceCodeAvailablePopup from './vune/MkSourceCodeAvailablePopup.vune';
import { miLocalStorage } from '@/local-storage.js';
import * as os from '@/os.js';

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

const zIndex = os.claimZIndex('low');

function close() {
	miLocalStorage.setItem('modifiedVersionMustProminentlyOfferInAgplV3Section13Read', 'true');
	emit('closed');
}
</script>
