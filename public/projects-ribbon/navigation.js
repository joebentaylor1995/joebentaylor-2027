'use strict';
// The standalone renderer owns its document; the host owns the public route.
const routeWindow = window.parent === window ? window : window.parent;
const routeLocation = routeWindow.location;
const routeHistory = routeWindow.history;

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
 if (event.source === routeWindow && event.origin === location.origin && event.data?.type === 'projects:route') syncProjectRoute();
});
// In the host, useSearchParams forwards Back/Forward without retaining listeners
// on the parent after this frame unmounts. Standalone previews listen locally.
if (routeWindow === window) window.addEventListener('popstate', syncProjectRoute);
