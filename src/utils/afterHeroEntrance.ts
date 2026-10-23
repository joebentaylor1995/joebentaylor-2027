// NOTE • Background work (the projects ribbon, poster preloads) waits for the homepage hero's
// text entrance: booting it alongside drops frames from the heading wipe on phones
const RUNNING_ENTRANCE = '[data-hero-content][data-entrance="running"]';
// A hidden or stalled hero must never hold the work back for good
const ENTRANCE_DEADLINE = 4000;

// Runs `start` once no hero entrance is playing (straight away if none is); returns a cleanup
export function afterHeroEntrance(start: () => void) {
	if (!document.querySelector(RUNNING_ENTRANCE)) {
		start();
		return () => {};
	}
	let waiting = true;
	const stop = () => {
		waiting = false;
		observer.disconnect();
		window.clearTimeout(deadline);
	};
	const finish = () => {
		if (!waiting) return;
		stop();
		start();
	};
	const observer = new MutationObserver(() => {
		if (!document.querySelector(RUNNING_ENTRANCE)) finish();
	});
	observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-entrance'] });
	const deadline = window.setTimeout(finish, ENTRANCE_DEADLINE);
	return stop;
}
