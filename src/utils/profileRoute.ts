// Profile panel route
// ------------
// NOTE • The profile panel is an overlay, not a page, but Sanity's
// Presentation tool picks the document to edit from the URL path. While the
// panel is open in Presentation the preview reports PROFILE_PATH, which
// sanity/presentation.ts maps to the “Profile panel” document.
//
// PROFILE_PATH isn't a real page: next.config.js redirects it to
// /?profile, and ProfileReveal opens the panel when it sees PROFILE_PARAM —
// so reloading Presentation (or sharing the link) lands on the open panel.
export const PROFILE_PATH = '/profile/';
export const PROFILE_PARAM = 'profile';

export const isProfilePath = (url: string) => {
	const { pathname } = new URL(url, 'http://localhost');
	return pathname === PROFILE_PATH || `${pathname}/` === PROFILE_PATH;
};
