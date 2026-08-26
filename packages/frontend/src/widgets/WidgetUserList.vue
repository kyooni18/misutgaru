<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneWidgetUserList :showHeader="widgetProps.showHeader" :listId="widgetProps.listId" :list="list" :users="users" :fetching="fetching" :rootClass="$style.root" :onChooseList="chooseList" :onConfigure="configure"/>
</template>

<script lang="ts" setup>
import VuneWidgetUserList from './vune/WidgetUserList.vune';
import { ref } from 'vue';
import * as Misskey from 'misskey-js';
import { useWidgetPropsManager } from './widget.js';
import type { WidgetComponentEmits, WidgetComponentExpose, WidgetComponentProps } from './widget.js';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { useInterval } from '@@/js/use-interval.js';
import { i18n } from '@/i18n.js';

const name = 'userList';

const widgetPropsDef = {
	showHeader: {
		type: 'boolean',
		label: i18n.ts._widgetOptions.showHeader,
		default: true,
	},
	listId: {
		type: 'string',
		default: null as string | null,
		hidden: true,
	},
} satisfies FormWithDefault;

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;

const props = defineProps<WidgetComponentProps<WidgetProps>>();
const emit = defineEmits<WidgetComponentEmits<WidgetProps>>();

const { widgetProps, configure, save } = useWidgetPropsManager(name,
	widgetPropsDef,
	props,
	emit,
);

const list = ref<Misskey.entities.UserList | null>(null);
const users = ref<Misskey.entities.UserDetailed[]>([]);
const fetching = ref(true);

async function chooseList() {
	const lists = await misskeyApi('users/lists/list');
	const { canceled, result: listId } = await os.select({
		title: i18n.ts.selectList,
		items: lists.map(x => ({
			value: x.id, label: x.name,
		})),
		default: widgetProps.listId,
	});
	if (canceled || listId == null) return;
	const list = lists.find(x => x.id === listId)!;
	widgetProps.listId = list.id;
	save();
	fetch();
}

const fetch = () => {
	if (widgetProps.listId == null) {
		fetching.value = false;
		return;
	}

	misskeyApi('users/lists/show', {
		listId: widgetProps.listId,
	}).then(_list => {
		list.value = _list;
		misskeyApi('users/show', {
			userIds: list.value.userIds ?? [],
		}).then(_users => {
			users.value = _users;
			fetching.value = false;
		});
	});
};

useInterval(fetch, 1000 * 60, {
	immediate: true,
	afterMounted: true,
});

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>

<style lang="scss" module>
.root {
	&:global {
		> .init {
			padding: 16px;
		}

		> .users {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(30px, 40px));
			grid-gap: 12px;
			place-content: center;
			padding: 16px;

			> .user {
				width: 100%;
				height: 100%;
				aspect-ratio: 1;

				> .avatar {
					width: 100%;
					height: 100%;
				}
			}
		}
	}
}
</style>
