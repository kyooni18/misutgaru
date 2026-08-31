<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneQr :read="read" :rootClass="$style.root" :mainClass="$style.main" :buttonClass="$style.button" :onToggle="() => read = !read"/>
</template>

<script lang="ts" setup>
import VuneQr from './vune/qr.vune?vue-host';
import { ref } from 'vue';
import { definePage } from '@/page.js';
import { i18n } from '@/i18n.js';
import { ensureSignin } from '@/i';

// router definitionでloginRequiredが設定されているためエラーハンドリングしない
const $i = ensureSignin();

const read = ref(false);
definePage(() => ({
	title: i18n.ts.qr,
	icon: 'ti ti-qrcode',
}));
</script>

<style lang="scss" module>
.root {
	height: 100%;
}

.main {
	min-height: 100%;
	display: flex;
	flex-direction: column;
	position: relative;
	z-index: 1;
}

.button {
	margin: 0 auto 16px auto;
}
</style>
