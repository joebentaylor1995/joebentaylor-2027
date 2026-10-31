// Imports
// ------------
import type Lenis from 'lenis';
import { lockProjectScroll } from './lockProjectScroll';
import { waitForProjectPreload } from './preloadProject';

// Constants
// ------------
export const PROJECT_HANDOFF_SETTLED = 'project-handoff:settled';

// State
// ------------
let nextProjectPending = false;

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
	const destination = new URL(href, location.href).pathname.replace(/\/$/, '');

	// Resolves with the new page's hero once it is in the DOM and the route has changed
	const ready = new Promise<HTMLElement>((resolve, reject) => {
		let frame = 0;

		const check = () => {
			const hero = Array.from(document.querySelectorAll<HTMLElement>('[data-project-hero]')).find(
				element => element !== previousHero && element.getBoundingClientRect().width > 0
			);
			if (location.pathname.replace(/\/$/, '') !== destination || !hero) return;
			lenis?.scrollTo(0, { immediate: true, force: true });
			document.querySelector('#page .lenis')?.scrollTo(0, 0);
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
		}, 15000);

		observer.observe(document.body, { childList: true, subtree: true, attributes: true });

		// Polls every frame too, since not every layout change is a mutation
		const poll = () => {
			frame = requestAnimationFrame(poll);
			check();
		};

		frame = requestAnimationFrame(poll);
		check();
	});

	try {
		navigate();
		await ready;

		// Two frames let the new page paint before the view transition is awaited
		await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
		await Promise.allSettled(
			document
				.getAnimations()
				.filter(
					animation =>
						animation.effect instanceof KeyframeEffect &&
						animation.effect.pseudoElement?.startsWith('::view-transition')
				)
				.map(animation => animation.finished)
		);
	} catch {
		// Interrupted navigation must never leave scrolling locked.
	} finally {
		await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
		if (location.pathname.replace(/\/$/, '') === destination) {
			lenis?.scrollTo(0, { immediate: true, force: true });
			document.querySelector('#page .lenis')?.scrollTo(0, 0);
		}

		nextProjectPending = false;
		delete document.documentElement.dataset.nextProjectTransition;
		unlock();
		window.dispatchEvent(new Event(PROJECT_HANDOFF_SETTLED));
	}
}
