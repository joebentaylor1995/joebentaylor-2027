// State
// ------------
// Prepare nearby scenes one at a time, independently of their animation visibility.
let preparation = Promise.resolve();

// Exports
// ------------
// Lets the browser paint between scene loads
export const yieldSceneWork = () => new Promise<void>(resolve => window.setTimeout(resolve, 0));

// Queues `load` for when the element nears the viewport; returns a cleanup
export function prepareScene(element: HTMLElement, load: () => Promise<unknown>, preloadScreens = 1) {
	let disposed = false;

	const root = element.closest('#profile-panel');

	const observer = new IntersectionObserver(
		([entry]) => {
			if (!entry.isIntersecting) return;
			observer.disconnect();
			preparation = preparation
				.catch(() => {})
				.then(async () => {
					await yieldSceneWork();
					if (!disposed) await load();
				})
				.catch(() => {});
		},
		{ root, rootMargin: `${(root?.clientHeight || window.innerHeight) * preloadScreens}px 0px` }
	);

	observer.observe(element);

	return () => {
		disposed = true;
		observer.disconnect();
	};
}
