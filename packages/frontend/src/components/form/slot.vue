<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div>
	<div class="mk-vune-form-slot__label"><slot name="label"></slot></div>
	<div><slot></slot></div>
	<div class="mk-vune-form-slot__caption"><slot name="caption"></slot></div>
</div>
</template>

<script lang="ts" setup>
import '@/components/vune/misskey-vune.scss';
</script>
