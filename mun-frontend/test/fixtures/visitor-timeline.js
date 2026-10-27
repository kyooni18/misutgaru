// SPDX-FileCopyrightText: Misutgaru contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { mount } from '@mun/web';
import App from './VisitorTimelineFixture.mun';
mount(App, document.getElementById('app'));
window.fixtureMounted = true;
