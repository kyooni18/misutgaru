<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneNotificationConfig
	:type="type"
	:typeDef="typeDef"
	:userListId="userListId"
	:userListIdDef="userListIdDef"
	:onType="value => type = value"
	:onUserListId="value => userListId = value"
	:onSave="save"
/>
</template>

<script lang="ts">
const notificationConfigTypes = [
	'all',
	'following',
	'follower',
	'mutualFollow',
	'followingOrFollower',
	'list',
	'never'
] as const;

export type NotificationConfig = {
	type: Exclude<typeof notificationConfigTypes[number], 'list'>;
} | {
	type: 'list';
	userListId: string;
};
</script>

<script lang="ts" setup>
import * as Misskey from 'misskey-js';
import VuneNotificationConfig from './vune/notifications.notification-config.vune';
import { ref, computed } from 'vue';
import { useMkSelect } from '@/composables/use-mkselect.js';
import { i18n } from '@/i18n.js';

const props = defineProps<{
	value: NotificationConfig;
	userLists: Misskey.entities.UserList[];
	configurableTypes?: NotificationConfig['type'][]; // If not specified, all types are configurable
}>();

const emit = defineEmits<{
	(ev: 'update', result: NotificationConfig): void;
}>();

const notificationConfigTypesI18nMap: Record<typeof notificationConfigTypes[number], string> = {
	all: i18n.ts.all,
	following: i18n.ts.following,
	follower: i18n.ts.followers,
	mutualFollow: i18n.ts.mutualFollow,
	followingOrFollower: i18n.ts.followingOrFollower,
	list: i18n.ts.userList,
	never: i18n.ts.none,
};

const {
	model: type,
	def: typeDef,
} = useMkSelect({
	items: computed(() => (props.configurableTypes ?? notificationConfigTypes).map((t: NotificationConfig['type']) => ({
		label: notificationConfigTypesI18nMap[t],
		value: t,
	}))),
	initialValue: props.value.type,
});
const {
	model: userListId,
	def: userListIdDef,
} = useMkSelect({
	items: computed(() => props.userLists.map(list => ({
		label: list.name,
		value: list.id,
	}))),
	initialValue: props.value.type === 'list' ? props.value.userListId : null,
});

function save() {
	emit('update', type.value === 'list' ? { type: type.value, userListId: userListId.value! } : { type: type.value });
}
</script>
