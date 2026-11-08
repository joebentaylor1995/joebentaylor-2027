// Imports
// ------------
import type Lenis from 'lenis';
import { lockProjectScroll } from './lockProjectScroll';
import { waitForProjectPreload } from './preloadProject';

// Constants
// ------------
export const PROJECT_HANDOFF_SETTLED = 'project-handoff:settled';

const NAVIGATION_TIMEOUT_MS = 15000;

// State
// ------------
let nextProjectPending = false;

// Helpers
// ------------
const trimTrailingSlash = (path: string) => path.replace(/\/$/, '');

const scrollLenisToTop = (lenis?: Lenis) => {
	lenis?.scrollTo(0, { immediate: true, force: true });
	document.querySelector('#page .lenis')?.scrollTo(0, 0);
};

const nextTwoFrames = () =>
	new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

const viewTransitionsSettled = () =>
	Promise.allSettled(
		document
			.getAnimations()
			.filter(
				animation =>
					animation.effect instanceof KeyframeEffect &&
					animation.effect.pseudoElement?.startsWith('::view-transition')
			)
			.map(animation => animation.finished)
	);

// Resolves with the new page's hero once it is in the DOM and the route has changed, scrolled to the top
const waitForNextHero = (previousHero: Element | null, destination: string, lenis?: Lenis) =>
	new Promise<HTMLElement>((resolve, reject) => {
		let frame = 0;

		const check = () => {
			// NOTE • Runs every frame and on every mutation batch: test the route first, since the hero lookup below
			// forces a layout and can't succeed before the route has changed
			if (trimTrailingSlash(location.pathname) !== destination) return;
			const hero = Array.from(document.querySelectorAll<HTMLElement>('[data-project-hero]')).find(
				element => element !== previousHero && element.getBoundingClientRect().width > 0
			);
			if (!hero) return;
			scrollLenisToTop(lenis);
			document.querySelector('#page')?.scrollTo(0, 0);
			observer.disconnect();
			cancelAnimationFrame(frame);
			clearTimeout(deadline);
			resolve(hero);
		};

		const observer = new MutationObserver(check);

		const deadline = window.setTimeout(() => {
			observer.disconnect();
			cancelAnimationFrame(frame);
			reject(new Error('Project navigation timed out'));
		}, NAVIGATION_TIMEOUT_MS);

		observer.observe(document.body, { childList: true, subtree: true, attributes: true });

		// Polls every frame too, since not every layout change is a mutation
		const poll = () => {
			frame = requestAnimationFrame(poll);
			check();
		};

		frame = requestAnimationFrame(poll);
		check();
	});

// Exports
// ------------
export const isProjectHandoffPending = () =>
	nextProjectPending || Boolean(document.querySelector('[data-project-handoff]'));

// ANCHOR • Moves to the next project without a flash: preloads its hero, locks scrolling,
// runs `navigate`, then waits for the new hero and the view transition before unlocking
export async function navigateNextProject(href: string, navigate: () => void, lenis?: Lenis) {
	if (nextProjectPending) return;

	nextProjectPending = true;
	const source = location.pathname;
	// Keep the current page intact while a cold destination image prepares.
	await waitForProjectPreload(href);
	if (location.pathname !== source) {
		nextProjectPending = false;
		window.dispatchEvent(new Event(PROJECT_HANDOFF_SETTLED));
		return;
	}

	document.documentElement.dataset.nextProjectTransition = 'true';

	const unlock = lockProjectScroll(lenis);

	const previousHero = document.querySelector('[data-project-hero]');
	const destination = trimTrailingSlash(new URL(href, location.href).pathname);
	const nextHero = waitForNextHero(previousHero, destination, lenis);

	try {
		navigate();
		await nextHero;

		// Two frames let the new page paint before the view transition is awaited
		await nextTwoFrames();
		await viewTransitionsSettled();
	} catch {
		// Interrupted navigation must never leave scrolling locked.
	} finally {
		await nextTwoFrames();
		if (trimTrailingSlash(location.pathname) === destination) scrollLenisToTop(lenis);

		nextProjectPending = false;
		delete document.documentElement.dataset.nextProjectTransition;
		unlock();
		window.dispatchEvent(new Event(PROJECT_HANDOFF_SETTLED));
	}
}
