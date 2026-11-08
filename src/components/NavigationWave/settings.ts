// Imports
// ------------
import { isWaveEase, type WaveEase } from './easing';

// Constants
// ------------
// NOTE • v2 came with the cinematic default: v1 held whole snapshots of the old settings, which
// would have kept the old easing and duration in any browser that had tuned the wave before
export const WAVE_STORAGE_KEY = 'jbt-navigation-wave-v2';
export const WAVE_SETTINGS_CHANGED = 'navigation-wave:settings';
// Fired when a page change's wave starts or ends, for the tuner (see waveTimeline)
export const WAVE_TIMELINE = 'navigation-wave:timeline';

// The duration setting's range in ms, which the tuner's slider shares
export const WAVE_DURATION = { min: 250, max: 3000, step: 50 } as const;

// Defaults: duration in ms, origin as a percent of the viewport, the rest tune the wave's shape
export const waveDefaults = {
	duration: 1500,
	originX: 50,
	originY: 50,
	width: 0.75,
	softness: 1.2,
	bend: 2.2,
	strength: 0.95,
	lensWidth: 0.6,
	lensFalloff: 1.45,
	ease: 'cinematicSoft' as WaveEase,
};

// Types
// ------------
export type WaveSettings = typeof waveDefaults;

// [key, label, min, max, step] for each numeric setting; saved values are clamped to these
export const waveRanges = [
	['duration', 'Duration (ms)', WAVE_DURATION.min, WAVE_DURATION.max, WAVE_DURATION.step],
	['originX', 'Origin X (%)', 0, 100, 1],
	['originY', 'Origin Y (% from bottom)', 0, 100, 1],
	['width', 'Wave width', 0.1, 3, 0.05],
	['softness', 'Edge softness', 0.1, 3, 0.05],
	['bend', 'Lens bend', 0, 5, 0.05],
	['strength', 'Distortion strength', 0, 3, 0.05],
	['lensWidth', 'Lens width', 0.1, 3, 0.05],
	['lensFalloff', 'Lens falloff', 0.1, 4, 0.05],
] as const;

// Helpers
// ------------
// Defaults overlaid with any valid saved values; storage problems never block navigation
export function readWaveSettings(): WaveSettings {
	const settings = { ...waveDefaults };
	if (typeof window === 'undefined') return settings;
	try {
		const saved: unknown = JSON.parse(localStorage.getItem(WAVE_STORAGE_KEY) || 'null');
		if (!saved || typeof saved !== 'object') return settings;
		for (const [key, , min, max] of waveRanges) {
			const value = key in saved ? Reflect.get(saved, key) : undefined;
			if (typeof value === 'number' && Number.isFinite(value))
				settings[key] = Math.min(max, Math.max(min, value));
		}
		const ease = 'ease' in saved ? saved.ease : undefined;
		if (isWaveEase(ease)) settings.ease = ease;
	} catch {
		// Unavailable storage or invalid settings should not prevent navigation.
	}
	return settings;
}

// Saves changes over what is stored, so two panels never revert each other, and tells the live wave
// and the panels to re-read them. The saved settings, or null if storage is unavailable.
export function saveWaveSettings(changes: Partial<WaveSettings>) {
	const settings = { ...readWaveSettings(), ...changes };
	try {
		localStorage.setItem(WAVE_STORAGE_KEY, JSON.stringify(settings));
	} catch {
		return null;
	}
	window.dispatchEvent(new Event(WAVE_SETTINGS_CHANGED));
	return settings;
}

// Store
// ------------
// NOTE • The settings panel's midway preview: NavigationWave registers these to
// draw (or clear) one point of the wave on the live page. Never saved.
export const wavePreview: {
	paint: ((progress: number) => void) | null;
	clear: (() => void) | null;
} = { paint: null, clear: null };

// NOTE • The tuner's handle on a running page change. NavigationWave publishes the wave's two
// clock animations (new page, old page) while it plays; scrubbing them moves both pages, since
// the wave redraws from their clock every frame. It also publishes the easing and duration that
// wave started with, which the saved settings may since have moved on from. `hold` (0–1) pauses
// each new wave at that point as it starts, and `rate` plays it in slow motion. Neither is saved.
export const waveTimeline: {
	current: { animations: Animation[]; duration: number; ease: WaveEase } | null;
	hold: number | null;
	rate: number;
} = { current: null, hold: null, rate: 1 };

// Holds the running wave at a point (0–1) of its timeline
export function holdWave(point: number) {
	const current = waveTimeline.current;
	if (!current) return;
	for (const animation of current.animations) {
		animation.pause();
		animation.currentTime = point * current.duration;
	}
}
