<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<VuneThemePreviewingHost />
</template>

<script lang="ts" setup>
import VuneThemePreviewing from './vune/ThemePreviewing.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';

const VuneThemePreviewingHost = createVuneWebHost(VuneThemePreviewing);
</script>
