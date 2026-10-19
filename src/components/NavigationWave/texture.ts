import type { WaveSettings } from './settings';

const TEXTURE_SIZE = 256;
let cachedKey = '';
let cachedTexture = '';

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
			pixels.data[index] = 128 + (dx / Math.max(distance, 0.001)) * shoulder * 110;
			pixels.data[index + 1] = 128 + (dy / Math.max(distance, 0.001)) * shoulder * 110;
			pixels.data[index + 2] = 128;
			pixels.data[index + 3] = 255;
		}
	}
	context.putImageData(pixels, 0, 0);
	cachedTexture = canvas.toDataURL();
	cachedKey = key;
	return cachedTexture;
}
