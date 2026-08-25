/* SPDX-License-Identifier: AGPL-3.0-only */
/* @misutgaru-vune-native */
import { Button, VStack } from 'vune-ui';
import MkResult from '../global/vune/MkResult.vune.js';
import { i18n } from '@/i18n.js';
import { ignoreRetry, type RetryAction, type RetryActions } from './MkError.types.js';
import './misskey-vune.scss';

export struct MkError: View {
	let actions: RetryActions

	init(@Action onRetry: RetryAction = ignoreRetry) {
		self.actions = { retry: onRetry }
	}

	var body: some View {
		VStack(alignment: 'center', spacing: 12) {
			MkResult('error')
			Button(i18n.ts.retry) {
				actions.retry()
			}
				.className(['_button', 'mk-vune-error__button'])
		}
	}
}

export default MkError
