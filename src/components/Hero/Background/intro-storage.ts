import { type IntroSettings, introDefaults, introEasings, mobileIntroDefaults } from './scene-intro';

export const INTRO_STORAGE_KEY = 'jbt-hero-wave-settings-v1';
export type IntroProfiles = { desktop: IntroSettings; mobile: IntroSettings };

export function readIntroProfiles(): IntroProfiles {
	const defaults = { desktop: { ...introDefaults }, mobile: { ...mobileIntroDefaults } };
	if (typeof window === 'undefined') return defaults;
	try {
		const saved = JSON.parse(localStorage.getItem(INTRO_STORAGE_KEY) || 'null');
		if (saved?.version !== 1 && saved?.version !== 2) return defaults;
		for (const device of ['desktop', 'mobile'] as const) {
			const input = saved[device];
			if (!input || typeof input !== 'object') continue;
			for (const key of Object.keys(defaults[device]) as (keyof IntroSettings)[]) {
				const value = input[key];
				if (key === 'ease' || key === 'portraitEase') {
					if (typeof value === 'string' && Object.hasOwn(introEasings, value))
						defaults[device][key] = value as IntroSettings['ease'];
				} else if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100) {
					if (['width', 'speed', 'softness', 'decay', 'portraitScale'].includes(key) && value === 0) continue;
					defaults[device][key] = value;
				}
			}
			// Keep saved placement and timing, but retire the old multi-ring default.
			if (saved.version === 1) defaults[device].rings = 0;
		}
	} catch {
		/* Invalid or unavailable storage falls back to the approved defaults. */
	}
	return defaults;
}
