// Imports
// ------------
import { RAD, xyz } from './projection';

// Types
// ------------
type Coordinate = [number, number];
type Polygon = Coordinate[][];
type Geography = {
	features: {
		geometry: { type: 'Polygon'; coordinates: Polygon } | { type: 'MultiPolygon'; coordinates: Polygon[] };
	}[];
};
export type GlobeGeometry = { outlines: Float32Array; grid: Float32Array; dots: Float32Array };

function withinRing(x: number, y: number, ring: Coordinate[]) {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i],
			[xj, yj] = ring[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}

function segment(target: number[], a: Coordinate, b: Coordinate) {
	let delta = b[0] - a[0];
	if (delta > 180) delta -= 360;
	if (delta < -180) delta += 360;
	const n = Math.max(1, Math.ceil(Math.max(Math.abs(delta), Math.abs(b[1] - a[1])) / 1.5));
	for (let i = 0; i < n; i++) {
		target.push(...xyz(a[0] + (delta * i) / n, a[1] + ((b[1] - a[1]) * i) / n));
		target.push(...xyz(a[0] + (delta * (i + 1)) / n, a[1] + ((b[1] - a[1]) * (i + 1)) / n));
	}
}

// Less than a third of a CSS pixel at the card's usual radius. Work in 3D
// so simplification also behaves correctly across the antimeridian and poles.
export function simplifyRing(ring: Coordinate[], tolerance = 0.0006): Coordinate[] {
	if (ring.length <= 3) return ring;
	const points = ring.map(([lon, lat]) => xyz(lon, lat));
	const keep = new Set([0, ring.length - 1]);
	const pending: [number, number][] = [[0, ring.length - 1]];
	while (pending.length) {
		const range = pending.pop();
		if (!range) break;
		const [first, last] = range;
		const a = points[first];
		const b = points[last];
		const delta = b.map((value, index) => value - a[index]);
		const length = delta.reduce((sum, value) => sum + value * value, 0);
		let furthest = -1;
		let maxDistance = tolerance * tolerance;
		for (let i = first + 1; i < last; i++) {
			const relative = points[i].map((value, index) => value - a[index]);
			const t = length
				? Math.max(
						0,
						Math.min(1, relative.reduce((sum, value, index) => sum + value * delta[index], 0) / length)
					)
				: 0;
			const distance = relative.reduce((sum, value, index) => sum + (value - t * delta[index]) ** 2, 0);
			if (distance > maxDistance) {
				maxDistance = distance;
				furthest = i;
			}
		}
		if (furthest !== -1) {
			keep.add(furthest);
			pending.push([first, furthest], [furthest, last]);
		}
	}
	return [...keep].sort((a, b) => a - b).map(index => ring[index]);
}

let cached: GlobeGeometry | undefined;
export async function loadGeometry(signal: AbortSignal): Promise<GlobeGeometry> {
	if (cached) return cached;
	const response = await fetch('/data/globe/countries.geojson', { signal });
	if (!response.ok) throw new Error('Globe geography could not load');
	const data: Geography = await response.json();
	signal.throwIfAborted();
	const outlines: number[] = [],
		grid: number[] = [],
		dots: number[] = [];
	const polygons: { rings: Polygon; minX: number; maxX: number; minY: number; maxY: number }[] = [];
	for (const feature of data.features) {
		const parts =
			feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
		for (const rings of parts) {
			let minX = 180,
				maxX = -180,
				minY = 90,
				maxY = -90;
			for (const [x, y] of rings[0]) {
				minX = Math.min(minX, x);
				maxX = Math.max(maxX, x);
				minY = Math.min(minY, y);
				maxY = Math.max(maxY, y);
			}
			polygons.push({ rings, minX, maxX, minY, maxY });
			for (const ring of rings) {
				const simplified = simplifyRing(ring);
				for (let i = 1; i < simplified.length; i++) segment(outlines, simplified[i - 1], simplified[i]);
			}
		}
	}
	for (let lat = -88; lat <= 88; lat += 1.35) {
		const step = 1.35 / Math.cos(lat * RAD);
		for (let lon = -180; lon < 180; lon += step) {
			if (
				polygons.some(
					p =>
						lon >= p.minX &&
						lon <= p.maxX &&
						lat >= p.minY &&
						lat <= p.maxY &&
						withinRing(lon, lat, p.rings[0]) &&
						!p.rings.slice(1).some(r => withinRing(lon, lat, r))
				)
			)
				dots.push(...xyz(lon, lat));
		}
	}
	for (let lat = -75; lat <= 75; lat += 15)
		for (let lon = -180; lon < 180; lon += 2) segment(grid, [lon, lat], [lon + 2, lat]);
	for (let lon = -180; lon < 180; lon += 15)
		for (let lat = -90; lat < 90; lat += 2) segment(grid, [lon, lat], [lon, lat + 2]);
	cached = {
		outlines: new Float32Array(outlines),
		grid: new Float32Array(grid),
		dots: new Float32Array(dots),
	};
	return cached;
}
