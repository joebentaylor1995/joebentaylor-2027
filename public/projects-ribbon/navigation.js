'use strict';
// The standalone renderer owns its document; the host owns the public route.
const routeWindow = window.parent === window ? window : window.parent;
const routeLocation = routeWindow.location;
const routeHistory = routeWindow.history;
// Same origin is the trust boundary: WebKit can report either window as a same-origin message's source,
// so checking only for the host's window would drop its messages at random
const fromHost = event => event.origin === location.origin && (event.source === routeWindow || event.source === window);

function syncProjectRoute() {
 if (typeof ready === 'undefined' || !ready) return;
 const slug = new URL(routeLocation.href).searchParams.get('project');
 if (!slug) {
  if (projectTransition.active || projectTransition.loading) projectTransition.returnToGallery();
 } else if (!projectTransition.active || projectTransition.slug(projectTransition.project) !== slug) {
  projectTransition.openRoute(slug);
 }
}
window.addEventListener('message', event => {
 if (fromHost(event) && event.data?.type === 'projects:route') syncProjectRoute();
});
// In the host, useSearchParams forwards Back/Forward without retaining listeners
// on the parent after this frame unmounts. Standalone previews listen locally.
if (routeWindow === window) window.addEventListener('popstate', syncProjectRoute);
