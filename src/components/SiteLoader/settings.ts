// NOTE • The intro's tunable options in one live object. The renderer reads it on
// every frame and the timeline reads it when it's built, so the ?loaderTweaks
// panel can change it and replay. Bake final values back into the defaults.

import type { gsap } from 'gsap';

export type LoaderSettings = {
	// Size of the whole intro relative to the video's full-frame staging
	scale: number;
	// The curved screen band — its aspect (32:9 = Odyssey G9) and how deep the curve is (1 = flat)
	screenAspect: number;
	screenCurve: number;
	// Playback speed of the whole loader (1 = the video's timing)
	speed: number;
	// The band's width, relative to the logo's landed width in the source video
	bandWidth: number;
	// Hold on the landed logo before the circle wipe
	revealGap: number;
};

export const DEFAULT_LOADER_SETTINGS: LoaderSettings = {
	scale: 0.39,
	screenAspect: 32 / 9,
	screenCurve: 0.64,
	speed: 1,
	bandWidth: 1,
	revealGap: 0.5,
};

export const loaderSettings: LoaderSettings = { ...DEFAULT_LOADER_SETTINGS };

// Dev hooks for the tweak panel: the live timeline and a replay trigger
export const LOADER_REPLAY = 'site-loader:replay';
export const loaderControl: { timeline: gsap.core.Timeline | null } = { timeline: null };
