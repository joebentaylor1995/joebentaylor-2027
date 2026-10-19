import { introEasings } from '@parts/Hero/Background/scene-intro';

export const WAVE_STORAGE_KEY = 'jbt-navigation-wave-v1';
export const WAVE_SETTINGS_CHANGED = 'navigation-wave:settings';
export const waveDefaults = {
	duration: 1250,
	originX: 50,
	originY: 50,
	width: 1,
	softness: 1,
	bend: 2.75,
	strength: 1,
	lensWidth: 1,
	lensFalloff: 1,
	ease: 'sine.out' as keyof typeof introEasings,
};
export type WaveSettings = typeof waveDefaults;

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
