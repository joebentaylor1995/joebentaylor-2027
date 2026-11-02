// Imports
// ------------
import { introEasings } from '@parts/Hero/Background/scene-intro';

// Constants
// ------------
// localStorage key for the saved fill settings, and the window events the ribbon listens
// for to play a fill preview or hold it at a point
export const FILL_STORAGE_KEY = 'jbt-project-fill-v1';
export const FILL_PREVIEW = 'project-fill:preview';
// Detail: the point of the flight to hold at (0–1), or null to let go
export const FILL_SCRUB = 'project-fill:scrub';

// NOTE • The ribbon is a standalone app in public/, which reads these from storage when a
// fill begins. Keep these defaults in step with PROJECT_FILL_DEFAULTS in its project-transition.js.
export const fillEasings = { custom: 'Custom — set by Settle softness', ...introEasings } as const;

// Durations are in ms; the rest are unitless tuning values (see `fillRanges` for labels and limits)
export const fillDefaults = {
	duration: 850,
	returnDuration: 1000,
	stagger: 0.34,
	easing: 'custom' as keyof typeof fillEasings,
	softness: 1.3,
	wave: 0.045,
	waves: 1.7,
	travel: 1.1,
	lift: 0.05,
	shading: 0.55,
};

// Slider definitions: [setting key, label, min, max, step]. Saved values are clamped to min/max on read.
export const fillRanges = [
	['duration', 'Fill duration (ms)', 300, 4000, 50],
	['returnDuration', 'Return duration (ms)', 300, 3000, 50],
	['stagger', 'Edge lag', 0, 0.8, 0.01],
	['softness', 'Settle softness', 1, 6, 0.1],
	['wave', 'Wave height', 0, 0.2, 0.005],
	['waves', 'Ripples', 0, 5, 0.1],
	['travel', 'Ripple speed', 0, 4, 0.1],
	['lift', 'Billow', 0, 0.3, 0.01],
	['shading', 'Fold shading', 0, 2, 0.05],
] as const;

// Types
// ------------
export type FillSettings = typeof fillDefaults;

// Helpers
// ------------
// Defaults overlaid with whatever valid values are saved; anything missing or malformed is ignored
export function readFillSettings(): FillSettings {
	const settings = { ...fillDefaults };
	try {
		const saved: unknown = JSON.parse(localStorage.getItem(FILL_STORAGE_KEY) || 'null');
		if (!saved || typeof saved !== 'object') return settings;

		for (const [key, , min, max] of fillRanges) {
			const value = key in saved ? Reflect.get(saved, key) : undefined;
			if (typeof value === 'number' && Number.isFinite(value))
				settings[key] = Math.min(max, Math.max(min, value));
		}

		if ('easing' in saved && typeof saved.easing === 'string' && Object.hasOwn(fillEasings, saved.easing))
			settings.easing = saved.easing as FillSettings['easing'];
	} catch {
		// Unavailable storage or invalid settings fall back to the defaults.
	}
	return settings;
}
