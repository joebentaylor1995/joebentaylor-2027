// Imports
// ------------
import { isLoaderSettled, LOADER_SETTLED } from '@parts/SiteLoader/events';
import { afterHeroEntrance } from './afterHeroEntrance';
import { isConstrained } from './pickVideoSource';

// Constants
// ------------
// NOTE • Every scene in the panel is inside this margin, so each one queues as the panel opens
const WHOLE_PANEL = 100_000;
// Longest a warm-up waits for the main thread to go quiet before running anyway
const IDLE_DEADLINE = 2000;
// A gap this long (ms) since the last scroll, wheel or touch move means the visitor has paused
const SCROLL_PAUSE = 300;
const SCROLLING = ['scroll', 'wheel', 'touchmove'] as const;
// Events that mean the visitor is about to scroll the panel (keys bubble up from the focused
// element inside it)
const SCROLL_INTENTS = ['scroll', 'wheel', 'touchstart', 'keydown'] as const;

// State
// ------------
// Scenes waiting to be built, and the run that is building them one at a time (independently
// of their animation visibility)
const waiting: { element: HTMLElement; build: () => Promise<unknown> }[] = [];
let preparation = Promise.resolve();
let building = false;
// Scenes waiting to be warmed (one at a time too, and never alongside a scene being built)
const cold: { element: Element; warm: () => Promise<unknown> }[] = [];
let warming = false;

// Helpers
// ------------
// Resolves when the main thread has a quiet moment (Safari before 18.4 has no requestIdleCallback)
const whenIdle = () =>
	new Promise<void>(resolve => {
		if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout: IDLE_DEADLINE });
		else setTimeout(resolve, 200);
	});

// Earlier in the page first
const inPageOrder = (a: { element: Element }, b: { element: Element }) =>
	a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;

// NOTE • Why: scenes queue in the order React runs their effects, which isn't the order they
// sit in the page (the awards came first, the toolkits at the top of the panel last). The next
// scene built is always the one highest up the page, since that is the one seen first.
async function buildWaiting() {
	// Scenes opening together all join the queue before the first is picked
	await yieldSceneWork();
	while (waiting.length) {
		const next = waiting.sort(inPageOrder).shift();
		await next?.build().catch(() => {});
		await yieldSceneWork();
	}
	building = false;
}

// NOTE • Why: a warm-up is speculative, and what the visitor is scrolling through right now
// is not. Each one evaluates an engine chunk and starts a batch of downloads, which landed in
// the middle of a case study's scroll (long tasks, and bandwidth taken from the media about to
// come into view). Warm-ups wait for a pause in the scrolling instead.
let lastScroll = Number.NEGATIVE_INFINITY;
const noteScroll = () => {
	lastScroll = performance.now();
};
const isScrolling = () => performance.now() - lastScroll < SCROLL_PAUSE;
const whenScrollPauses = async () => {
	while (isScrolling()) await new Promise(resolve => setTimeout(resolve, SCROLL_PAUSE));
};

// Warm-ups go in page order as well, each from a quiet moment on the main thread
async function warmWaiting() {
	// Scrolls of nested scrollers (the page's, a panel's) don't bubble, so they are caught on the way down
	for (const type of SCROLLING) addEventListener(type, noteScroll, { capture: true, passive: true });
	while (cold.length) {
		await whenIdle();
		// A scene being built has the main thread and the network to itself, and so has a scroll
		if (building || isScrolling()) {
			await Promise.all([preparation, whenScrollPauses()]);
			continue;
		}
		const next = cold.sort(inPageOrder).shift();
		await next?.warm().catch(() => {});
	}
	for (const type of SCROLLING) removeEventListener(type, noteScroll, { capture: true });
	warming = false;
}

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

// ANCHOR • Fetches a scene's code and assets while its panel is still closed (`element` places
// it in the page's order); returns a cleanup
// NOTE • Why: every scene used to start from nothing once the panel was open and the scene a
// screen away: its engine chunk, then its artwork, geometry or posters, then the build. On a
// phone or an ordinary connection that outlasted the scroll there, so scenes appeared on screen
// still loading. `warm` does the fetching (and whatever decoding can be kept) ahead of time,
// from the page's idle moments once the loader and the hero entrance are done, so opening the
// panel only has to build. Skipped for a visitor saving data or on a slow connection, who gets
// the previous on-demand loading.
export function warmScene(element: Element | null, warm: () => Promise<unknown>) {
	if (!element || isConstrained()) return () => {};

	const scene = { element, warm };
	let stopWaiting = () => {};

	const enqueue = () => {
		cold.push(scene);
		if (warming) return;
		warming = true;
		void warmWaiting();
	};
	const start = () => {
		stopWaiting = afterHeroEntrance(enqueue);
	};

	if (isLoaderSettled()) start();
	else window.addEventListener(LOADER_SETTLED, start, { once: true });

	return () => {
		window.removeEventListener(LOADER_SETTLED, start);
		stopWaiting();
		const index = cold.indexOf(scene);
		if (index >= 0) cold.splice(index, 1);
	};
}

// ANCHOR • Runs `start` as the panel opens: at once for an element already on screen, otherwise
// when the opening wipe ends or the visitor reaches to scroll (see afterOpening); returns a cleanup
export function whenPanelOpens(element: HTMLElement, start: () => void) {
	let stopWaiting: (() => void) | undefined;

	const root = element.closest<HTMLElement>('#profile-panel');

	const observer = new IntersectionObserver(
		([entry]) => {
			if (!entry.isIntersecting) return;
			observer.disconnect();
			if (root && !onScreen(entry, WHOLE_PANEL)) stopWaiting = afterOpening(root, element, start);
			else start();
		},
		{ root, rootMargin: `${WHOLE_PANEL}px 0px` }
	);

	observer.observe(element);

	return () => {
		observer.disconnect();
		stopWaiting?.();
	};
}

// ANCHOR • Queues `load` as the panel opens, whatever the scene's distance; returns a cleanup
// NOTE • Why: scenes used to queue a screen (the awards, three) before they scrolled in, so a
// visitor moving at any speed caught them mid-build, and each build landed in the middle of the
// scroll. They now all queue when the panel opens and build one after another in page order
// while the visitor is still at the top, so each is ready, and its work done, before it is seen.
export function prepareScene(element: HTMLElement, load: () => Promise<unknown>) {
	let disposed = false;
	const scene = { element, build: async () => (disposed ? undefined : load()) };

	const stopWaiting = whenPanelOpens(element, () => {
		waiting.push(scene);
		if (building) return;
		building = true;
		preparation = buildWaiting();
	});

	return () => {
		disposed = true;
		stopWaiting();
		const index = waiting.indexOf(scene);
		if (index >= 0) waiting.splice(index, 1);
	};
}
