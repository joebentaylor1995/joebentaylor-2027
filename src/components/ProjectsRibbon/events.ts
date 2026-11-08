// Events
// ------------
// Asks the ribbon to show the featured ribbon rather than the all-projects grid.
// Detail: `instant` — true when /projects isn't on screen yet, so the grid's 2.2s
// hand-back is skipped instead of playing as the page arrives.
export const SHOW_FEATURED = 'projects-ribbon:show-featured';

// Exports
// ------------
export const showFeaturedProjects = (instant: boolean) =>
	window.dispatchEvent(new CustomEvent(SHOW_FEATURED, { detail: { instant } }));
