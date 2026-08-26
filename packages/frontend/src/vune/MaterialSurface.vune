/* SPDX-License-Identifier: AGPL-3.0-only */
/* @misutgaru-vune-native */
import { ZStack, type ViewGraphValue } from 'vune-ui';
import { Material } from '@/vune/material.js';
import '@/vune/material.scss';

export struct MaterialSurface: View {
	let material: Material
	let content: ViewGraphValue

	init(_ material: Material = Material.regular, @ViewBuilder content: ViewGraphValue) {
		self.material = material
		self.content = content
	}

	var body: some View {
		ZStack(alignment: 'center') {
			content
		}
			.className(['vune-material', `vune-material--${material.name}`])
			.withProps({ 'data-vune-material': material.name })
	}
}

export default MaterialSurface
