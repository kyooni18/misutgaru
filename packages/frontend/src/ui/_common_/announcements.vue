<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<VuneAnnouncementsHost />
</template>

<script lang="ts" setup>
import Announcements from './vune/announcements.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';

const VuneAnnouncementsHost = createVuneWebHost(Announcements);
</script>
