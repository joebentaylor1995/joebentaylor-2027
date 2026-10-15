import { loadGeometry } from './geometry';

self.onmessage = async () => {
	try {
		const geometry = await loadGeometry(new AbortController().signal);
		self.postMessage({ geometry }, { transfer: Object.values(geometry).map(layer => layer.buffer) });
	} catch (error) {
		self.postMessage({ error: error instanceof Error ? error.message : 'Globe geometry failed' });
	}
};
