<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneInvite
	:showInvites="showInvites"
	:resetCycle="resetCycle"
	:inviteLimit="inviteLimit"
	:currentInviteLimit="currentInviteLimit"
	:paginator="paginator"
	:onCreate="create"
	:onDeleted="deleted"
/>
</template>

<script lang="ts" setup>
import { computed, markRaw, ref } from 'vue';
import VuneInvite from './vune/invite.vune?vue-host';
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { definePage } from '@/page.js';
import { instance } from '@/instance.js';
import { $i } from '@/i.js';
import { Paginator } from '@/utility/paginator.js';

const currentInviteLimit = ref<null | number>(null);
const inviteLimit = (($i != null && $i.policies.inviteLimit) || (($i == null && instance.policies.inviteLimit))) as number;
const inviteLimitCycle = (($i != null && $i.policies.inviteLimitCycle) || ($i == null && instance.policies.inviteLimitCycle)) as number;
const showInvites = computed(() => instance.disableRegistration && !!($i && ($i.isAdmin || $i.policies.canInvite)));

const paginator = markRaw(new Paginator('invite/list', {
	limit: 10,
}));

const resetCycle = computed<null | string>(() => {
	if (!inviteLimitCycle) return null;

	const minutes = inviteLimitCycle;
	if (minutes < 60) return minutes + i18n.ts._time.minute;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return hours + i18n.ts._time.hour;
	return Math.floor(hours / 24) + i18n.ts._time.day;
});

async function create() {
	const ticket = await misskeyApi('invite/create');
	os.alert({
		type: 'success',
		title: i18n.ts.inviteCodeCreated,
		text: ticket.code,
	});

	paginator.prepend(ticket);
	update();
}

function deleted(id: string) {
	paginator.removeItem(id);
	update();
}

async function update() {
	currentInviteLimit.value = (await misskeyApi('invite/limit')).remaining;
}

update();

definePage(() => ({
	title: i18n.ts.invite,
	icon: 'ti ti-user-plus',
}));
</script>
