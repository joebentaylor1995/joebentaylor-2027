// Imports
// ------------
import type { GlobeGeometry } from './geometry';

// Helpers
// ------------
// Built once per page load, then reused by every later globe
let cached: GlobeGeometry | undefined;

// Polygon tests and vertex generation must not block the modal's scroll ticker.
// Aborting the signal terminates the worker and rejects with the signal's reason.
export async function loadGeometry(signal: AbortSignal): Promise<GlobeGeometry> {
	signal.throwIfAborted();
	if (cached) return cached;
	return new Promise((resolve, reject) => {
		const worker = new Worker(new URL('./geometry.worker.ts', import.meta.url));

		// Tear down the worker and abort listener whichever way the request ends
		const cleanup = () => {
			worker.terminate();
			signal.removeEventListener('abort', abort);
		};
		const abort = () => {
			cleanup();
			reject(signal.reason);
		};

		signal.addEventListener('abort', abort, { once: true });

		worker.onmessage = (event: MessageEvent<{ geometry?: GlobeGeometry; error?: string }>) => {
			cleanup();
			if (!event.data.geometry) {
				reject(new Error(event.data.error ?? 'Globe geometry missing'));
				return;
			}
			cached = event.data.geometry;
			resolve(cached);
		};

		worker.onerror = event => {
			cleanup();
			reject(new Error(event.message));
		};

		worker.postMessage('load');
	});
}
