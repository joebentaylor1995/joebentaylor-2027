import type { WaveSettings } from './settings';

const TEXTURE_SIZE = 256;
const LENS_AMPLITUDE = 110;
const LENS_SCALE = 0.09;
const COLOR_RANGE = 255;
const NEUTRAL = 128;
const GUARD_DOWNSCALE = 4;
const GUARD_MAX_FRACTION = 0.25;
let cachedKey = '';
let cachedTexture = '';
let cachedGuardKey = '';
let cachedGuard = '';

// The displacement at the wave's peak, in the units of feDisplacementMap's scale
export function lensScale(settings: WaveSettings, height: number) {
	return height * LENS_SCALE * settings.bend * settings.strength;
}

// NOTE • The lens samples outward, so near the viewport's edges it reads past the snapshot
// and gets transparent pixels, which show the body through both pages. This overlay fades
// the map back to neutral over a band as wide as the largest offset. A linear ramp keeps
// every offset within the snapshot. The cap stops extreme settings flattening the whole wave.
export function edgeGuardTexture(settings: WaveSettings, width: number, height: number) {
	const largestOffset = (lensScale(settings, height) * LENS_AMPLITUDE) / COLOR_RANGE;
	const band = Math.max(1, Math.min(largestOffset, Math.min(width, height) * GUARD_MAX_FRACTION));
	const key = `${width}:${height}:${band}`;
	if (cachedGuard && key === cachedGuardKey) return cachedGuard;
	const columns = Math.ceil(width / GUARD_DOWNSCALE);
	const rows = Math.ceil(height / GUARD_DOWNSCALE);
	const canvas = document.createElement('canvas');
	canvas.width = columns;
	canvas.height = rows;
	const context = canvas.getContext('2d');
	if (!context) return '';
	const pixels = context.createImageData(columns, rows);
	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < columns; x++) {
			const distance = Math.min(x, y, columns - 1 - x, rows - 1 - y) * GUARD_DOWNSCALE;
			const index = (y * columns + x) * 4;
			pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = NEUTRAL;
			pixels.data[index + 3] = COLOR_RANGE * Math.max(0, 1 - distance / band);
		}
	}
	context.putImageData(pixels, 0, 0);
	cachedGuard = canvas.toDataURL();
	cachedGuardKey = key;
	return cachedGuard;
}

export function waveTexture(settings: WaveSettings) {
	const key = `${settings.lensWidth}:${settings.lensFalloff}`;
	if (cachedTexture && key === cachedKey) return cachedTexture;
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = TEXTURE_SIZE;
	const context = canvas.getContext('2d');
	if (!context) return '';
	const pixels = context.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
	const centre = (TEXTURE_SIZE - 1) / 2;
	for (let y = 0; y < TEXTURE_SIZE; y++) {
		for (let x = 0; x < TEXTURE_SIZE; x++) {
			const dx = (x - centre) / centre;
			const dy = (y - centre) / centre;
			const distance = Math.hypot(dx, dy);
			const shoulder = Math.exp(
				-(Math.abs((distance - 0.65) / (0.18 * settings.lensWidth)) ** Math.max(1, settings.lensFalloff * 2))
			);
			const index = (y * TEXTURE_SIZE + x) * 4;
			pixels.data[index] = NEUTRAL + (dx / Math.max(distance, 0.001)) * shoulder * LENS_AMPLITUDE;
			pixels.data[index + 1] = NEUTRAL + (dy / Math.max(distance, 0.001)) * shoulder * LENS_AMPLITUDE;
			pixels.data[index + 2] = NEUTRAL;
			pixels.data[index + 3] = 255;
		}
	}
	context.putImageData(pixels, 0, 0);
	cachedTexture = canvas.toDataURL();
	cachedKey = key;
	return cachedTexture;
}
