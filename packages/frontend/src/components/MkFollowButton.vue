<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<NativeFollowButton :user="user" :full="full" :large="large" :className="typeof $attrs.class === 'string' ? $attrs.class : ''" :onUpdateUser="(value: Misskey.entities.UserDetailed) => emit('update:user', value)"/>
</template>
<script lang="ts" setup>
import type * as Misskey from 'misskey-js';
import VuneFollowButton from './vune/MkFollowButton.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
const NativeFollowButton = createVuneWebHost(VuneFollowButton);
defineProps<{ user: Misskey.entities.UserDetailed; full?: boolean; large?: boolean }>();
const emit = defineEmits<{ (_: 'update:user', value: Misskey.entities.UserDetailed): void }>();
</script>
