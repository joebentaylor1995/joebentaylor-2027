// NOTE • A hover-sized cut of the loader's landing (see SiteLoader/intro.ts): hard cuts held for
// one 30fps frame each, a blue ghost, and bands that jump sideways or drop out. The header has no
// fixed background to paint the loader's black cuts in, so a dropped band is simply hidden.

// Constants
// ------------
// Frames per second the glitch steps at (each frame is a hard cut, not a tween)
export const GLITCH_FPS = 30;

// The logo's horizontal bands, as [top, bottom] in viewBox units
export const SLICES = [
	[0, 3.2],
	[3.2, 6.2],
	[6.2, 13],
	[13, 17],
	[17, 21.5],
	[21.5, 26],
] as const;

// Types
// ------------
export type GlitchFrame = {
	ghost?: { dx?: number; dy?: number; scale?: number };
	// One per slice: its sideways offset in viewBox units, or null to drop it out
	slices: readonly (number | null)[];
};

// Timeline
// ------------
// One entry per frame, played in order at GLITCH_FPS. `dx`/`dy` move the ghost in viewBox
// units; each slice entry lines up with the same index in SLICES.
export const GLITCH_FRAMES: readonly GlitchFrame[] = [
	{ ghost: { dx: -2, dy: 1.5 }, slices: [0, 0, 0, 0, 0, 0] },
	{ ghost: { dx: -1.5, dy: -2, scale: 1.05 }, slices: [0, 2, 0, -1.5, 0, null] },
	{ ghost: { dx: 1.5, dy: 1 }, slices: [null, -3, 1, 0, 2, 0] },
	{ slices: [1.5, 0, null, 2.5, 0, -2] },
	{ ghost: { dx: -1, dy: 1 }, slices: [0, null, 0, 0, -3, 0] },
	{ ghost: { dx: 2, scale: 1.08 }, slices: [-2, 1.5, 0, null, 0, 1.5] },
	{ slices: [0, 0, null, 0, 1, 0] },
	{ ghost: { dx: -0.8, dy: 0.6 }, slices: [0, 0.8, 0, -1, 0, 0] },
	{ slices: [0, 0, 0, 0, null, 0] },
	{ slices: [0, -0.6, 0, 0, 0, 0] },
	{ ghost: { dx: 0.5 }, slices: [0, 0, 0, 0, 0, 0] },
];
