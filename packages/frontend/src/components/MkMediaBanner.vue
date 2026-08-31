<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<NativeMediaBanner :hidden="hide" :mediaName="media.name" :mediaUrl="media.url" :rootClass="$style.root" :sensitiveClass="$style.sensitive" :downloadClass="$style.download" :onReveal="reveal"/>
</template>

<script lang="ts" setup>
import VuneMediaBanner from './vune/MkMediaBanner.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
import * as Misskey from 'misskey-js';
import { i18n } from '@/i18n.js';
import { canRevealFile, useSensitiveFileVisibility } from '@/utility/sensitive-file.js';

const NativeMediaBanner = createVuneWebHost(VuneMediaBanner);

const props = defineProps<{
	media: Misskey.entities.DriveFile;
	forceShow?: boolean;
}>();

const hide = useSensitiveFileVisibility(() => props.media, { forceShow: () => props.forceShow === true });

async function reveal() {
	if (!(await canRevealFile(props.media))) {
		return;
	}

	hide.value = false;
}
</script>

<style lang="scss" module>
.root {
	width: 100%;
	border-radius: 4px;
	margin-top: 4px;
	overflow: clip;
}

.download,
.sensitive {
	display: flex;
	align-items: center;
	font-size: 12px;
	padding: 8px 12px;
	white-space: nowrap;
}

.download {
}

.sensitive {
	background: #111;
	color: #fff;
}

.audio {
	border-radius: 8px;
	overflow: clip;
}
</style>
