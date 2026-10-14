// Persistent layout: reveal once per document, then let route entrances start immediately.
export const LOADER_REVEAL = 'site-loader:reveal';
let pending = true;
export const isLoaderPending = () => pending;
export const revealScene = () => {
	pending = false;
	window.dispatchEvent(new Event(LOADER_REVEAL));
};
