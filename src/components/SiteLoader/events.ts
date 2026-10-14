// Persistent layout: reveal once per document, then let route entrances start immediately.
export const LOADER_REVEAL = 'site-loader:reveal';
export const LOADER_SETTLED = 'site-loader:settled';
let pending = true;
let settled = false;
export const isLoaderPending = () => pending;
export const isLoaderSettled = () => settled;
export const settleLoader = () => {
	settled = true;
	window.dispatchEvent(new Event(LOADER_SETTLED));
};
export const revealScene = () => {
	pending = false;
	window.dispatchEvent(new Event(LOADER_REVEAL));
};
