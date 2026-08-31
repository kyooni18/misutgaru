<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<span v-bind="attrs" class="mk-vune-avatar-legacy-host">
	<NativeMkAvatar
		:user="user"
		:target="target"
		:link="link"
		:preview="preview"
		:indicator="indicator"
		:decorations="decorations"
		:forceShowDecoration="forceShowDecoration"
		:style="{ width: '100%', height: '100%' }"
		:onClick="onClick"
	/>
</span>
</template>
<script lang="ts" setup>
import { useAttrs } from 'vue';
import VuneMkAvatar from './vune/MkAvatar.vune';
import type * as Misskey from 'misskey-js';
import { createVuneWebHost } from '@/vune/compat-vue.js';

defineOptions({ inheritAttrs: false });

type Decoration = Omit<Misskey.entities.UserDetailed['avatarDecorations'][number], 'id'> & { blink?: boolean };

const props = withDefaults(defineProps<{
	user: Misskey.entities.User;
	target?: string | null;
	link?: boolean;
	preview?: boolean;
	indicator?: boolean;
	decorations?: Decoration[];
	forceShowDecoration?: boolean;
}>(), {
	target: null,
	link: false,
	preview: false,
	indicator: false,
	decorations: undefined,
	forceShowDecoration: false,
});

const emit = defineEmits<{ (ev: 'click', value: PointerEvent): void }>();
const attrs = useAttrs();
const NativeMkAvatar = createVuneWebHost(VuneMkAvatar);

function onClick(event: PointerEvent): void {
	if (!props.link) emit('click', event);
}
</script>
