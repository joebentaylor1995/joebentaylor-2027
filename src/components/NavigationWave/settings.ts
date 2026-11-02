// Imports
// ------------
import { introEasings } from '@parts/Hero/Background/scene-intro';

// Constants
// ------------
export const WAVE_STORAGE_KEY = 'jbt-navigation-wave-v1';
export const WAVE_SETTINGS_CHANGED = 'navigation-wave:settings';

// Defaults: duration in ms, origin as a percent of the viewport, the rest tune the wave's shape
export const waveDefaults = {
	duration: 850,
	originX: 50,
	originY: 50,
	width: 0.75,
	softness: 1.2,
	bend: 2.2,
	strength: 0.95,
	lensWidth: 0.6,
	lensFalloff: 1.45,
	ease: 'sine.inOut' as keyof typeof introEasings,
};

// Types
// ------------
export type WaveSettings = typeof waveDefaults;

// [key, label, min, max, step] for each numeric setting; saved values are clamped to these
export const waveRanges = [
	['duration', 'Duration (ms)', 250, 3000, 50],
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
		if ('ease' in saved && typeof saved.ease === 'string' && Object.hasOwn(introEasings, saved.ease))
			settings.ease = saved.ease as WaveSettings['ease'];
	} catch {
		// Unavailable storage or invalid settings should not prevent navigation.
	}
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
