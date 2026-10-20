// The profile keeps the underlying page mounted throughout its close animation.
// Observe its presentation state so rendering resumes only when it is uncovered.
export function observeScenePause(element: Element, update: (paused: boolean) => void) {
	const scene = element.closest<HTMLElement>('[data-profile-scene]');
	const sync = () => update(scene?.dataset.scenePaused === 'true');
	const observer = new MutationObserver(sync);
	if (scene) observer.observe(scene, { attributes: true, attributeFilter: ['data-scene-paused'] });
	sync();
	return () => observer.disconnect();
}
