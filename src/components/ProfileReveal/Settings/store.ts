export const defaults = {
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
};
export type ModalSettings = typeof defaults;
export type NumberSetting = {
	[K in keyof ModalSettings]: ModalSettings[K] extends number ? K : never;
}[keyof ModalSettings];
export const ranges: Record<NumberSetting, [number, number, number]> = {
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
};
export const STORAGE_KEY = 'jbt-modal-settings-v2';
let settings = { ...defaults };
const subscribers = new Set<() => void>();
export const getSettings = () => settings;
export const subscribe = (callback: () => void) => {
	subscribers.add(callback);
	return () => {
		subscribers.delete(callback);
	};
};
export function updateSettings(values: Partial<ModalSettings>) {
	const next = { ...settings };
	for (const key of Object.keys(defaults) as (keyof ModalSettings)[]) {
		const value = values[key];
		if (typeof defaults[key] === 'boolean' && typeof value === 'boolean') {
			Object.assign(next, { [key]: value });
		} else if (typeof value === 'number' && Number.isFinite(value)) {
			const range = ranges[key as NumberSetting];
			if (range) Object.assign(next, { [key]: Math.min(range[1], Math.max(range[0], value)) });
		}
	}
	settings = next;
	for (const callback of subscribers) callback();
}
