// Profile panel route
// ------------
// NOTE • The profile panel is an overlay, not a page, but Sanity's
// Presentation tool picks the document to edit from the URL path. While the
// panel is open in Presentation the preview reports PROFILE_PATH, which
// sanity/presentation.ts maps to the “Profile panel” document.
//
// Direct visits rewrite to the home scene without changing the URL.
// The shared modal route controller opens Profile after the loader settles.
export const PROFILE_PATH = '/profile/';
export const PROFILE_PARAM = 'profile';

export const isProfilePath = (url: string) => {
	const { pathname } = new URL(url, 'http://localhost');
	return pathname === PROFILE_PATH || `${pathname}/` === PROFILE_PATH;
};
