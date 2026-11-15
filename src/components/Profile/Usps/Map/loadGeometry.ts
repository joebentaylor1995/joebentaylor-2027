// Imports
// ------------
import type { GlobeGeometry } from './geometry';
import { GEOMETRY_URL, unpack } from './packing';

// Helpers
// ------------
// Read once per page load, then reused by every later globe
let cached: GlobeGeometry | undefined;

// A warm-up still reading the geometry (see warmGeometry)
let warming: Promise<GlobeGeometry> | undefined;

// NOTE • Why: the vertex buffers are built ahead of time (scripts/build-globe.ts), so the page only
// downloads and unpacks them. The download and the inflate run off the main thread; unpacking is a
// few milliseconds of integer maths, far too little to disturb the modal's scroll ticker.
// Aborting the signal cancels the download and rejects with the signal's reason.
async function readGeometry(signal: AbortSignal): Promise<GlobeGeometry> {
	try {
		const response = await fetch(GEOMETRY_URL, { signal });
		if (!response.ok || !response.body) throw new Error('Globe geometry could not load');
		const inflated = response.body.pipeThrough(new DecompressionStream('deflate-raw'));
		const packed = new Uint8Array(await new Response(inflated).arrayBuffer());
		signal.throwIfAborted();
		cached = unpack(packed);
		return cached;
	} catch (error) {
		signal.throwIfAborted();
		throw error;
	}
}

// Exports
// ------------
// Reads the geometry ahead of the globe (while the profile is closed), so the globe only has
// to draw it. Never rejects: a failed warm-up leaves the globe to read its own.
export function warmGeometry() {
	if (cached || warming) return warming?.catch(() => undefined) ?? Promise.resolve(cached);
	const current = readGeometry(new AbortController().signal).finally(() => {
		if (warming === current) warming = undefined;
	});
	warming = current;
	return current.catch(() => undefined);
}

// The globe's geometry: the cached copy, the one a warm-up is still reading, or a new read
export async function loadGeometry(signal: AbortSignal): Promise<GlobeGeometry> {
	signal.throwIfAborted();
	if (cached) return cached;
	if (warming) {
		const stopped = new Promise<never>((_, reject) => {
			signal.addEventListener('abort', () => reject(signal.reason), { once: true });
		});
		try {
			return await Promise.race([warming, stopped]);
		} catch {
			signal.throwIfAborted();
		}
	}
	return readGeometry(signal);
}
