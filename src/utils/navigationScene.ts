// Constants
// ------------
const NAVIGATION_RECOVERY_TIMEOUT = 10_000;

// State
// ------------
let releaseTimer = 0;

// Exports
// ------------
// Unfreezes the scene (clears the pending flag and its recovery timer)
export function releaseNavigationScene() {
	window.clearTimeout(releaseTimer);
	delete document.documentElement.dataset.navigationPending;
}

// ANCHOR • Freeze the outgoing GPU scene as soon as Next accepts the navigation.
// Its last frame remains available to the native view-transition snapshot.
export function prepareNavigationScene(href: string) {
	// Same-page navigations never freeze anything
	if (new URL(href, location.href).pathname.replace(/\/$/, '') === location.pathname.replace(/\/$/, '')) return;

	window.clearTimeout(releaseTimer);
	document.documentElement.dataset.navigationPending = 'true';

	// A failed navigation must not leave the current scene frozen.
	releaseTimer = window.setTimeout(releaseNavigationScene, NAVIGATION_RECOVERY_TIMEOUT);
}

// New pages can show their native content while GPU uploads wait for the wave.
export function waitForNavigationScene(signal: AbortSignal) {
	const root = document.documentElement;

	const paused = () => root.matches('[data-navigation-pending], [data-navigation-wave]');
	if (signal.aborted || !paused()) return Promise.resolve();

	return new Promise<void>(resolve => {
		const finish = () => {
			observer.disconnect();
			signal.removeEventListener('abort', finish);
			resolve();
		};
		const observer = new MutationObserver(() => {
			if (!paused()) finish();
		});

		observer.observe(root, {
			attributes: true,
			attributeFilter: ['data-navigation-pending', 'data-navigation-wave'],
		});
		signal.addEventListener('abort', finish, { once: true });
	});
}
