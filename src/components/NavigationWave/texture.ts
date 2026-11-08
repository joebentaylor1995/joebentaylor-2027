// Imports
// ------------
import type { WaveSettings } from './settings';

// Constants
// ------------
// Both generated maps are images fed to SVG feDisplacementMap: the red/green channels hold
// the x/y displacement, with NEUTRAL (128) meaning "no movement".
const TEXTURE_SIZE = 256;
const LENS_AMPLITUDE = 110;
const LENS_SCALE = 0.09;
const COLOR_RANGE = 255;
const NEUTRAL = 128;
const GUARD_DOWNSCALE = 4;
const GUARD_MAX_FRACTION = 0.25;
// Idle generation (ms): the longest wait for an idle period before the browser runs a chunk
// anyway, the time to leave in an idle period when a chunk stops, and the chunk budget where
// requestIdleCallback is missing (Safari), whose chunks run right after a frame instead
const IDLE_TIMEOUT_MS = 3000;
const IDLE_RESERVE_MS = 1;
const FALLBACK_CHUNK_MS = 4;

// Types
// ------------
// One map: its cache key, size in pixels, and how to fill one row of RGBA pixels
interface TexturePlan {
	key: string;
	columns: number;
	rows: number;
	fillRow: (data: Uint8ClampedArray, y: number) => void;
}

// A cached map: the key it was made for and its image URL
interface TextureSlot {
	key: string;
	url: string;
}

// Cache
// ------------
// Each map is regenerated only when the settings that shape it change
const waveSlot: TextureSlot = { key: '', url: '' };
const guardSlot: TextureSlot = { key: '', url: '' };

// Helpers
// ------------
// The displacement at the wave's peak, in the units of feDisplacementMap's scale
export function lensScale(settings: WaveSettings, height: number) {
	return height * LENS_SCALE * settings.bend * settings.strength;
}

// Radial "lens" displacement map: a ring (peak at 0.65 of the radius) that pushes pixels
// outward from the centre. `lensWidth` thickens the ring; `lensFalloff` sharpens its edges.
function wavePlan(settings: WaveSettings): TexturePlan {
	const centre = (TEXTURE_SIZE - 1) / 2;

	return {
		key: `${settings.lensWidth}:${settings.lensFalloff}`,
		columns: TEXTURE_SIZE,
		rows: TEXTURE_SIZE,
		fillRow: (data, y) => {
			for (let x = 0; x < TEXTURE_SIZE; x++) {
				// Position from the centre, normalised so the texture edge is 1
				const dx = (x - centre) / centre;
				const dy = (y - centre) / centre;
				const distance = Math.hypot(dx, dy);

				// Ring strength (0..1) at this distance from the centre
				const shoulder = Math.exp(
					-(
						Math.abs((distance - 0.65) / (0.18 * settings.lensWidth)) **
						Math.max(1, settings.lensFalloff * 2)
					)
				);

				// Red/green carry the outward direction scaled by the ring; blue stays neutral; fully opaque
				const index = (y * TEXTURE_SIZE + x) * 4;
				data[index] = NEUTRAL + (dx / Math.max(distance, 0.001)) * shoulder * LENS_AMPLITUDE;
				data[index + 1] = NEUTRAL + (dy / Math.max(distance, 0.001)) * shoulder * LENS_AMPLITUDE;
				data[index + 2] = NEUTRAL;
				data[index + 3] = 255;
			}
		},
	};
}

// NOTE • The lens samples outward, so near the viewport's edges it reads past the snapshot
// and gets transparent pixels, which show the body through both pages. This overlay fades
// the map back to neutral over a band as wide as the largest offset. A linear ramp keeps
// every offset within the snapshot. The cap stops extreme settings flattening the whole wave.
// The map is drawn at 1/GUARD_DOWNSCALE size since it is a smooth ramp.
function guardPlan(settings: WaveSettings, width: number, height: number): TexturePlan {
	const largestOffset = (lensScale(settings, height) * LENS_AMPLITUDE) / COLOR_RANGE;
	const band = Math.max(1, Math.min(largestOffset, Math.min(width, height) * GUARD_MAX_FRACTION));
	const columns = Math.ceil(width / GUARD_DOWNSCALE);
	const rows = Math.ceil(height / GUARD_DOWNSCALE);

	return {
		key: `${width}:${height}:${band}`,
		columns,
		rows,
		// Neutral grey whose alpha falls from opaque at the edge to transparent `band` px inward
		fillRow: (data, y) => {
			for (let x = 0; x < columns; x++) {
				const distance = Math.min(x, y, columns - 1 - x, rows - 1 - y) * GUARD_DOWNSCALE;
				const index = (y * columns + x) * 4;
				data[index] = data[index + 1] = data[index + 2] = NEUTRAL;
				data[index + 3] = COLOR_RANGE * Math.max(0, 1 - distance / band);
			}
		},
	};
}

// A blank canvas the size of the plan, with its 2D context and pixel buffer
function createSurface(plan: TexturePlan) {
	const canvas = document.createElement('canvas');
	canvas.width = plan.columns;
	canvas.height = plan.rows;
	const context = canvas.getContext('2d');
	if (!context) return null;
	return { canvas, context, pixels: context.createImageData(plan.columns, plan.rows) };
}

// Points a slot at a new map
function store(slot: TextureSlot, key: string, url: string) {
	slot.key = key;
	slot.url = url;
}

// The slot's map for this plan, drawn and PNG-encoded now if it isn't cached
function cachedOrRender(slot: TextureSlot, plan: TexturePlan) {
	if (slot.url && plan.key === slot.key) return slot.url;

	const surface = createSurface(plan);
	if (!surface) return '';
	for (let y = 0; y < plan.rows; y++) plan.fillRow(surface.pixels.data, y);
	surface.context.putImageData(surface.pixels, 0, 0);
	const url = surface.canvas.toDataURL();
	store(slot, plan.key, url);
	return url;
}

// Resolves in the browser's next idle period. Without requestIdleCallback, it resolves just
// after the next frame, with a fixed budget, so a chunk still lands where a frame has room.
function idlePeriod() {
	return new Promise<IdleDeadline>(resolve => {
		if (typeof requestIdleCallback === 'function') {
			requestIdleCallback(resolve, { timeout: IDLE_TIMEOUT_MS });
			return;
		}
		requestAnimationFrame(() =>
			setTimeout(() => {
				const start = performance.now();
				resolve({
					didTimeout: false,
					timeRemaining: () => Math.max(0, FALLBACK_CHUNK_MS - (performance.now() - start)),
				});
			})
		);
	});
}

// Draws a plan's map in idle time and resolves with its PNG data URL (null if abandoned)
async function renderWhenIdle(plan: TexturePlan, isCancelled: () => boolean) {
	const surface = createSurface(plan);
	if (!surface) return null;

	// Rows in idle-period chunks, so the pixel loop never holds up a frame. A callback forced
	// by the timeout has no idle time left, so it gets a fixed budget instead of a single row.
	let y = 0;
	while (y < plan.rows) {
		const deadline = await idlePeriod();
		if (isCancelled()) return null;
		const budgetEnd = performance.now() + FALLBACK_CHUNK_MS;
		const hasTime = () =>
			deadline.didTimeout ? performance.now() < budgetEnd : deadline.timeRemaining() > IDLE_RESERVE_MS;
		do {
			plan.fillRow(surface.pixels.data, y++);
		} while (y < plan.rows && hasTime());
	}
	surface.context.putImageData(surface.pixels, 0, 0);

	// toBlob encodes the PNG asynchronously (toDataURL blocks the main thread while it encodes);
	// read back as a data URL it is the very string toDataURL gives, so the lens loads it as before
	const blob = await new Promise<Blob | null>(resolve => surface.canvas.toBlob(resolve));
	if (!blob || isCancelled()) return null;
	return new Promise<string | null>(resolve => {
		const reader = new FileReader();
		reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
		reader.onerror = () => resolve(null);
		reader.readAsDataURL(blob);
	});
}

// Exports
// ------------
// The lens map's image URL, drawn now if it isn't cached
export function waveTexture(settings: WaveSettings) {
	return cachedOrRender(waveSlot, wavePlan(settings));
}

// The edge guard's image URL for this viewport, drawn now if it isn't cached
export function edgeGuardTexture(settings: WaveSettings, width: number, height: number) {
	return cachedOrRender(guardSlot, guardPlan(settings, width, height));
}

// NOTE • Makes both maps ahead of the first navigation without touching a busy frame: the
// pixels fill in idle time and the PNGs encode asynchronously (the same pixels, losslessly
// encoded, that waveTexture and edgeGuardTexture make). A navigation that starts first draws
// its maps synchronously as before, and this then keeps those rather than swapping images.
export async function prepareTextures(
	settings: WaveSettings,
	width: number,
	height: number,
	isCancelled: () => boolean
) {
	const wave = wavePlan(settings);
	const guard = guardPlan(settings, width, height);
	// Maps made by either path are kept: replacing them could swap the lens's images mid-wave.
	// Both are published together, so a navigation never pairs a new map with a missing one.
	const isSettled = () => isCancelled() || waveSlot.url !== '' || guardSlot.url !== '';
	if (isSettled()) return;
	const waveUrl = await renderWhenIdle(wave, isSettled);
	const guardUrl = waveUrl && (await renderWhenIdle(guard, isSettled));
	if (!waveUrl || !guardUrl || isSettled()) return;
	store(waveSlot, wave.key, waveUrl);
	store(guardSlot, guard.key, guardUrl);
}
