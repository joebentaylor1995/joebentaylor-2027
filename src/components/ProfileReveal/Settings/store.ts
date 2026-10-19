import { mq } from '@tackl';

export const defaults = {
	matrixSpeed: 1.9,
	matrixBrightness: 0.95,
	matrixGlow: 0.8,
	matrixFace: 2.3,
	matrixDepth: 0,
	matrixBend: 0.2,
	matrixPortraitSize: 0.95,
	designToolkitSize: 100,
	developmentToolkitSize: 100,
	mobileFaceSmall: true,
	mobileFaceSize: 1.15,
	awardSize: 85,
	awardZoom: 1,
	awardSpeed: 2.4,
	awardDragEasing: 0.18,
	awardScrollBoost: 2,
	awardHoverIntensity: 0.1,
	awardFocusDuration: 0.6,
	keycapX: 11.2,
	keycapY: 23.3,
	keycapSize: 107.3,
	keycapRotation: -2.2,
	keycapTilt: false,
	keycapSound: true,
	globeZoom: 1.29,
	globeLatitude: 4.2,
	globeLongitude: 37.3,
	globeX: 8.6,
	globeY: 3.6,
	globeFollow: true,
	globeIntro: 3.2,
	globeFade: 1.1,
	globeDotSize: 10,
	globePulse: true,
	globePulseDuration: 2.4,
	globePulseScale: 3,
	aboutScrollDistance: 400,
	aboutStartZoom: 150,
	aboutFinalOpacity: 40,
	aboutIntroParallax: -50,
	aboutExitParallax: 50,
	aboutPreviousZoom: 25,
};
export type ModalSettings = typeof defaults;
export const mobileDefaults: ModalSettings = {
	...defaults,
	designToolkitSize: 90,
	developmentToolkitSize: 90,
	mobileFaceSize: 0.75,
	awardSize: 89,
	awardZoom: 1.55,
	keycapX: 22.9,
	keycapY: 14,
	keycapSize: 81.8,
	globeZoom: 2.02,
};
export type NumberSetting = {
	[K in keyof ModalSettings]: ModalSettings[K] extends number ? K : never;
}[keyof ModalSettings];
export const ranges: Record<NumberSetting, [number, number, number]> = {
	matrixSpeed: [0, 5, 0.1],
	matrixBrightness: [0, 2, 0.05],
	matrixGlow: [0, 2, 0.05],
	matrixFace: [0, 4, 0.1],
	matrixDepth: [0, 2, 0.05],
	matrixBend: [0, 2, 0.05],
	matrixPortraitSize: [0.5, 2, 0.05],
	designToolkitSize: [40, 130, 1],
	developmentToolkitSize: [40, 130, 1],
	mobileFaceSize: [0.6, 1.45, 0.05],
	awardSize: [50, 150, 1],
	awardZoom: [0.5, 3, 0.05],
	awardSpeed: [0, 5, 0.1],
	awardDragEasing: [0.02, 0.8, 0.01],
	awardScrollBoost: [0, 3, 0.1],
	awardHoverIntensity: [0, 2, 0.05],
	awardFocusDuration: [0.2, 3, 0.05],
	keycapX: [-100, 100, 0.1],
	keycapY: [-100, 100, 0.1],
	keycapSize: [20, 200, 0.1],
	keycapRotation: [-180, 180, 0.1],
	globeZoom: [0.5, 2.5, 0.01],
	globeLatitude: [-85, 85, 0.1],
	globeLongitude: [-180, 180, 0.1],
	globeX: [-100, 100, 0.1],
	globeY: [-100, 100, 0.1],
	globeIntro: [0.1, 10, 0.1],
	globeFade: [0.1, 5, 0.1],
	globeDotSize: [4, 24, 0.5],
	globePulseDuration: [0.5, 6, 0.1],
	globePulseScale: [1.5, 5, 0.1],
	aboutScrollDistance: [100, 1200, 10],
	aboutStartZoom: [100, 250, 1],
	aboutFinalOpacity: [0, 100, 1],
	aboutIntroParallax: [-100, 0, 1],
	aboutExitParallax: [0, 100, 1],
	aboutPreviousZoom: [0, 100, 1],
};
export const STORAGE_KEY = 'jbt-modal-settings-v2';
export type SettingsTarget = 'mobile' | 'desktop';
let desktopSettings = { ...defaults };
let mobileSettings = { ...mobileDefaults };
const subscribers = new Set<() => void>();
let desktopQuery: MediaQueryList | undefined;
const notify = () => {
	for (const callback of subscribers) callback();
};
export const getSettingsTarget = (): SettingsTarget => {
	if (typeof window === 'undefined') return 'mobile';
	desktopQuery ??= window.matchMedia(mq.up.l);
	return desktopQuery.matches ? 'desktop' : 'mobile';
};
export const getSettingsFor = (target: SettingsTarget) => (target === 'mobile' ? mobileSettings : desktopSettings);
export const getSettings = () => getSettingsFor(getSettingsTarget());
export const getSavedSettings = () => ({ desktop: desktopSettings, mobile: mobileSettings });
export const subscribe = (callback: () => void) => {
	if (!subscribers.size && typeof window !== 'undefined') {
		desktopQuery ??= window.matchMedia(mq.up.l);
		desktopQuery.addEventListener('change', notify);
	}
	subscribers.add(callback);
	return () => {
		subscribers.delete(callback);
		if (!subscribers.size && desktopQuery) {
			desktopQuery.removeEventListener('change', notify);
			desktopQuery = undefined;
		}
	};
};
export function updateSettings(values: Partial<ModalSettings>, target: SettingsTarget = 'desktop') {
	const next = { ...getSettingsFor(target) };
	for (const key of Object.keys(defaults) as (keyof ModalSettings)[]) {
		const value = values[key];
		if (typeof defaults[key] === 'boolean' && typeof value === 'boolean') {
			Object.assign(next, { [key]: value });
		} else if (typeof value === 'number' && Number.isFinite(value)) {
			const range = ranges[key as NumberSetting];
			if (range) Object.assign(next, { [key]: Math.min(range[1], Math.max(range[0], value)) });
		}
	}
	if (target === 'mobile') mobileSettings = next;
	else desktopSettings = next;
	notify();
}
export function restoreSettings(saved: unknown) {
	if (!saved || typeof saved !== 'object') return;
	if ('desktop' in saved && 'mobile' in saved) {
		if (saved.desktop && typeof saved.desktop === 'object') updateSettings(saved.desktop, 'desktop');
		if (saved.mobile && typeof saved.mobile === 'object') updateSettings(saved.mobile, 'mobile');
	} else {
		// Existing shared settings become the starting point for both independent profiles.
		updateSettings(saved, 'desktop');
		updateSettings(saved, 'mobile');
	}
}
