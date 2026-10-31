'use strict';

// Navigation
// ------------
// Keeps the iframe's gallery in step with the host page's `?project=` route.
// Loaded first. Uses `ready` and `projectTransition` lazily, as both are
// defined by later scripts (app.js, project-transition.js).

// Route access
// ------------
// The standalone renderer owns its document; the host owns the public route.
const routeWindow = window.parent === window ? window : window.parent;
const routeLocation = routeWindow.location;
const routeHistory = routeWindow.history;

// Same origin is the trust boundary: WebKit can report either window as a same-origin message's source,
// so checking only for the host's window would drop its messages at random
const fromHost = event => event.origin === location.origin && (event.source === routeWindow || event.source === window);

// Route sync
// ------------

// Opens or closes the project view so it matches the current `?project=` slug.
// A no-op until the first frame has loaded (`ready`).
function syncProjectRoute() {
	if (typeof ready === 'undefined' || !ready) return;

	const slug = new URL(routeLocation.href).searchParams.get('project');

	if (!slug) {
		if (projectTransition.active || projectTransition.loading) projectTransition.returnToGallery();
	} else if (!projectTransition.active || projectTransition.slug(projectTransition.project) !== slug) {
		projectTransition.openRoute(slug);
	}
}

// Listeners
// ------------
window.addEventListener('message', event => {
	if (fromHost(event) && event.data?.type === 'projects:route') syncProjectRoute();
});

// In the host, useSearchParams forwards Back/Forward without retaining listeners
// on the parent after this frame unmounts. Standalone previews listen locally.
if (routeWindow === window) window.addEventListener('popstate', syncProjectRoute);
