/* SPDX-License-Identifier: AGPL-3.0-only */

export type MiniChartData = {
	viewBoxX: number;
	viewBoxY: number;
	polygonPoints: string;
	polylinePoints: string;
	headX: number | undefined;
	headY: number | undefined;
};

export function makeMiniChartData(values: number[], viewBoxX = 50, viewBoxY = 50): MiniChartData {
	const stats = values.slice().reverse();
	const peak = Math.max.apply(null, stats) || 1;
	const step = stats.length > 1 ? viewBoxX / (stats.length - 1) : 0;
	const points = stats.map((value, index) => [index * step, (1 - (value / peak)) * viewBoxY]);
	const polylinePoints = points.map(point => `${point[0]},${point[1]}`).join(' ');
	const polygonPoints = `0,${viewBoxY} ${polylinePoints} ${viewBoxX},${viewBoxY}`;
	const head = points.at(-1);
	return {
		viewBoxX,
		viewBoxY,
		polygonPoints,
		polylinePoints,
		headX: head?.[0],
		headY: head?.[1],
	};
}
