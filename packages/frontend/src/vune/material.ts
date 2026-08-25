/* SPDX-License-Identifier: AGPL-3.0-only */

export type MaterialName = 'ultraThin' | 'thin' | 'regular' | 'thick' | 'ultraThick' | 'bar';

/** SwiftUI-style material descriptor. Rendering is owned by MaterialSurface. */
export class Material {
	private constructor(public readonly name: MaterialName) {}

	public static readonly ultraThin = new Material('ultraThin');
	public static readonly thin = new Material('thin');
	public static readonly regular = new Material('regular');
	public static readonly thick = new Material('thick');
	public static readonly ultraThick = new Material('ultraThick');
	public static readonly bar = new Material('bar');
}
