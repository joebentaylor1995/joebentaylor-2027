// Persistent layout: reveal once per document, then let route entrances start immediately.
export const LOADER_REVEAL = 'site-loader:reveal';
export const LOADER_SETTLED = 'site-loader:settled';
export const LOADER_RESET = 'site-loader:reset';
// Fires when the intro's logo lands and holds still, before the wipe — a quiet
// moment for heavy setup (WebGL, textures) the loader still covers
export const LOADER_LANDED = 'site-loader:landed';
let pending = true;
let landed = false;
let settled = false;
export const resetLoader = () => {
	pending = true;
	landed = false;
	settled = false;
	window.dispatchEvent(new Event(LOADER_RESET));
};
export const isLoaderPending = () => pending;
export const isLoaderSettled = () => settled;
export const settleLoader = () => {
	settled = true;
	document.documentElement.removeAttribute('data-loader-pending');
	window.dispatchEvent(new Event(LOADER_SETTLED));
};
export const landLoader = () => {
	if (landed) return;
	landed = true;
	window.dispatchEvent(new Event(LOADER_LANDED));
};
// Runs `start` once the loader has landed (straight away if it already has);
// returns a cleanup for effects
export const whenLoaderLanded = (start: () => void) => {
	if (landed) {
		start();
		return () => {};
	}
	window.addEventListener(LOADER_LANDED, start, { once: true });
	return () => window.removeEventListener(LOADER_LANDED, start);
};
export const revealScene = () => {
	landLoader();
	pending = false;
	window.dispatchEvent(new Event(LOADER_REVEAL));
};
