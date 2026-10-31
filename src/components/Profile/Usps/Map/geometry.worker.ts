// Imports
// ------------
import { loadGeometry } from './geometry';

// Worker
// ------------
// Builds the globe geometry on message, then transfers the typed-array buffers back (no copy)
self.onmessage = async () => {
	try {
		const geometry = await loadGeometry(new AbortController().signal);
		self.postMessage({ geometry }, { transfer: Object.values(geometry).map(layer => layer.buffer) });
	} catch (error) {
		self.postMessage({ error: error instanceof Error ? error.message : 'Globe geometry failed' });
	}
};
