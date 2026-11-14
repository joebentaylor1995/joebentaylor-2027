// Imports
// ------------
import { introEasings } from '@parts/Hero/Background/scene-intro';
import { gsap } from 'gsap';

// Types
// ------------
type Curve = readonly [x1: number, y1: number, x2: number, y2: number];

// Constants
// ------------
// The wave's own cubic-bézier curves. Each starts with zero slope, so the reveal never snaps
// out of the click, then surges and glides home; they differ in how long the launch takes.
// NOTE • The lens bends the old page in proportion to the wave's size, so a slow launch leaves the
// old page still for longer: at 750ms the cinematic wave is 100px across by ~60ms, the soft one by
// ~140ms. The default (soft, see waveDefaults) runs over 1500ms, which doubles both.
const curves = {
	cinematic: [0.2, 0, 0, 1],
	cinematicSteady: [0.3, 0, 0, 1],
	cinematicSoft: [0.45, 0, 0.1, 1],
} as const satisfies Record<string, Curve>;

// Newton steps tried before falling back to bisection, and the error either one settles for
const NEWTON_STEPS = 8;
const PRECISION = 1e-6;

// Every easing the wave offers, with its label: its own curves first, then the shared GSAP set
export const waveEasings = {
	cinematic: 'Cinematic — moves at once, long glide',
	cinematicSteady: 'Cinematic steady — gentler launch',
	cinematicSoft: 'Cinematic soft — slow build, then a surge',
	...introEasings,
	// The shared set calls this one cinematic too; renamed here so the list has one 'Cinematic'
	'power2.inOut': 'Power2 — slow / fast / slow',
} as const;

export type WaveEase = keyof typeof waveEasings;

// Helpers
// ------------
// A CSS-style cubic-bézier timing function: solves the curve's x for `progress`, returns its y
function cubicBezier([x1, y1, x2, y2]: Curve) {
	const cx = 3 * x1,
		bx = 3 * (x2 - x1) - cx,
		ax = 1 - cx - bx;
	const cy = 3 * y1,
		by = 3 * (y2 - y1) - cy,
		ay = 1 - cy - by;
	const x = (t: number) => ((ax * t + bx) * t + cx) * t;
	const y = (t: number) => ((ay * t + by) * t + cy) * t;
	const slope = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

	return (progress: number) => {
		if (progress <= 0) return 0;
		if (progress >= 1) return 1;
		let t = progress;
		for (let step = 0; step < NEWTON_STEPS; step++) {
			const error = x(t) - progress;
			if (Math.abs(error) < PRECISION) return y(t);
			const gradient = slope(t);
			if (Math.abs(gradient) < PRECISION) break;
			t -= error / gradient;
		}
		// Newton stalled on a flat stretch: bisect instead, which always converges
		let low = 0,
			high = 1;
		t = progress;
		while (high - low > PRECISION) {
			if (x(t) < progress) low = t;
			else high = t;
			t = (low + high) / 2;
		}
		return y(t);
	};
}

// Exports
// ------------
// Whether a saved value names one of the wave's easings
export const isWaveEase = (value: unknown): value is WaveEase =>
	typeof value === 'string' && Object.hasOwn(waveEasings, value);

// The easing function for a name: one of the wave's own curves, or GSAP's
export function waveEase(name: WaveEase): (progress: number) => number {
	return Object.hasOwn(curves, name) ? cubicBezier(curves[name as keyof typeof curves]) : gsap.parseEase(name);
}
