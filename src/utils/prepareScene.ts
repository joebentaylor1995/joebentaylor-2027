// Constants
// ------------
// Events that mean the visitor is about to scroll the panel (keys bubble up from the focused
// element inside it)
const SCROLL_INTENTS = ['scroll', 'wheel', 'touchstart', 'keydown'] as const;

// State
// ------------
// Prepare nearby scenes one at a time, independently of their animation visibility.
let preparation = Promise.resolve();

// Helpers
// ------------
// Whether the entry's element is inside the root itself, not just inside its preload margin
// (rootBounds is the root's box grown by the vertical margin)
const onScreen = ({ boundingClientRect: box, rootBounds }: IntersectionObserverEntry, margin: number) =>
	!rootBounds || (box.bottom > rootBounds.top + margin && box.top < rootBounds.bottom - margin);

// NOTE • Why: opening the profile mounts every section at once, and the scenes within a screen or
// three of the top (the toolkits, the globe, sometimes the awards) started building WebGL,
// decoding artwork and uploading textures during the panel's 1s opening wipe. A scene that isn't
// on screen yet now waits for the panel's own transition to finish, so the wipe isn't competing
// with work nobody can see yet. The wait ends early the moment the visitor reaches to scroll the
// panel (a wheel, a touch, a key, or the scroll itself) or the scene comes on screen, so one who
// scrolls during the wipe starts the scenes about as soon as before. Scenes already on screen,
// and steady-state scrolling, load as before. Returns a cleanup.
function afterOpening(root: HTMLElement, element: HTMLElement, run: () => void) {
	const opening = root
		.getAnimations()
		.filter(
			animation => animation.playState === 'running' && animation.effect?.getComputedTiming().endTime !== Infinity
		);
	if (!opening.length) {
		run();
		return undefined;
	}

	let pending = true;
	const waiting = new AbortController();
	const visible = new IntersectionObserver(
		([entry]) => {
			if (entry.isIntersecting) done();
		},
		{ root }
	);
	function done() {
		if (!pending) return;
		pending = false;
		visible.disconnect();
		waiting.abort();
		run();
	}

	visible.observe(element);
	for (const intent of SCROLL_INTENTS) root.addEventListener(intent, done, { passive: true, signal: waiting.signal });
	void Promise.all(opening.map(animation => animation.finished.catch(() => undefined))).then(done);

	return () => {
		pending = false;
		visible.disconnect();
		waiting.abort();
	};
}

// Exports
// ------------
// Lets the browser paint between scene loads
export const yieldSceneWork = () => new Promise<void>(resolve => window.setTimeout(resolve, 0));

// Queues `load` for when the element nears the viewport; returns a cleanup
export function prepareScene(element: HTMLElement, load: () => Promise<unknown>, preloadScreens = 1) {
	let disposed = false;
	let stopWaiting: (() => void) | undefined;

	const root = element.closest<HTMLElement>('#profile-panel');
	const margin = (root?.clientHeight || window.innerHeight) * preloadScreens;

	const enqueue = () => {
		preparation = preparation
			.catch(() => {})
			.then(async () => {
				await yieldSceneWork();
				if (!disposed) await load();
			})
			.catch(() => {});
	};

	const observer = new IntersectionObserver(
		([entry]) => {
			if (!entry.isIntersecting) return;
			observer.disconnect();
			if (root && !onScreen(entry, margin)) stopWaiting = afterOpening(root, element, enqueue);
			else enqueue();
		},
		{ root, rootMargin: `${margin}px 0px` }
	);

	observer.observe(element);

	return () => {
		disposed = true;
		observer.disconnect();
		stopWaiting?.();
	};
}
