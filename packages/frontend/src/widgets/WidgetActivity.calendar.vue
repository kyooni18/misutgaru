<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<script lang="ts">
import WidgetActivityCalendar from './vune/WidgetActivity.calendar.vune';
import { createVuneWebHost } from '@/vune/compat-vue.js';
export default createVuneWebHost(WidgetActivityCalendar);
</script>
