// Project modal entry
// ------------
// NOTE • Remembers that a project modal was opened from inside the site (a
// ribbon or grid click), so closing it can step Back to the projects page
// instead of replacing a direct visit's only history entry.

// Constants
// ------------
export const PROJECTS_PATH = '/projects/';

// Helpers
// ------------
const normalise = (href: string) => href.replace(/\/+$/, '');

// State
// ------------
let entry: string | null = null;

// Exports
// ------------
export const markProjectModalEntry = (href: string) => {
	entry = normalise(href);
};

// NOTE • Repeatable rather than one-shot: React's development StrictMode mounts
// the modal twice, and a consumed marker would make the second mount forget it
export const isProjectModalEntry = (href: string) => entry === normalise(href);

// NOTE • Called once the modal has actually been left
export const clearProjectModalEntry = () => {
	entry = null;
};
