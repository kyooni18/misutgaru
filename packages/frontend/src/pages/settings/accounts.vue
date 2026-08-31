<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<VuneAccounts :accounts="accounts" :userClass="$style.user" :onAddAccount="addAccount" :onShowMenu="showMenu"/>
</template>

<script lang="ts" setup>
import VuneAccounts from './vune/accounts.vune?vue-host';
import { computed } from 'vue';
import type { MenuItem } from '@/types/menu.js';
import * as os from '@/os.js';
import { switchAccount, removeAccount, login, getAccountWithSigninDialog, getAccountWithSignupDialog, getAccounts } from '@/accounts.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';

const accounts = await getAccounts();

function refreshAllAccounts() {
	// TODO
}

function showMenu(host: string, id: string, ev: PointerEvent) {
	let menu: MenuItem[];

	menu = [{
		text: i18n.ts.switch,
		icon: 'ti ti-switch-horizontal',
		action: () => switchAccount(host, id),
	}, {
		text: i18n.ts.remove,
		icon: 'ti ti-trash',
		action: () => removeAccount(host, id),
	}];

	os.popupMenu(menu, ev.currentTarget ?? ev.target);
}

function addAccount(ev: PointerEvent) {
	os.popupMenu([{
		text: i18n.ts.existingAccount,
		action: () => { addExistingAccount(); },
	}, {
		text: i18n.ts.createAccount,
		action: () => { createAccount(); },
	}], ev.currentTarget ?? ev.target);
}

function addExistingAccount() {
	getAccountWithSigninDialog().then((res) => {
		if (res != null) {
			os.success();
		}
	});
}

function createAccount() {
	getAccountWithSignupDialog().then((res) => {
		if (res != null) {
			login(res.token);
		}
	});
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.accounts,
	icon: 'ti ti-users',
}));
</script>

<style lang="scss" module>
.user {
	cursor: pointer;
}

.unknownUser {
	display: flex;
	align-items: center;
	text-align: start;
	padding: 16px;
	background: var(--MI_THEME-panel);
	border-radius: 8px;
	font-size: 0.9em;
}

.unknownUserAvatarMock {
	display: block;
	width: 34px;
	height: 34px;
	line-height: 34px;
	text-align: center;
	font-size: 16px;
	margin-right: 12px;
	background-color: color-mix(in srgb, var(--MI_THEME-fg), transparent 85%);
	color: color-mix(in srgb, var(--MI_THEME-fg), transparent 25%);
	border-radius: 50%;
}

.unknownUserTitle {
	display: block;
	width: 100%;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	line-height: 18px;
}

.unknownUserSub {
	display: block;
	width: 100%;
	font-size: 95%;
	opacity: 0.7;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	line-height: 16px;
}
</style>
