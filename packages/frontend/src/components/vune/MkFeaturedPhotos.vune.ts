/* SPDX-License-Identifier: AGPL-3.0-only */
/* @misutgaru-vune-native */
import { Group, Rectangle } from 'vune-ui';
import { instance } from '@/instance.js';
import './misskey-vune.scss';

export struct MkFeaturedPhotos: View {
	init() {}

	var body: some View {
		Group() {
			if (instance?.backgroundImageUrl) {
				Rectangle()
					.className('mk-vune-featured-photos')
					.style({ backgroundImage: `url(${instance.backgroundImageUrl})` })
			}
		}
	}
}

export default MkFeaturedPhotos
