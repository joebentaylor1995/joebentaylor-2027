// Media URLs
// ------------
// NOTE • Sanity file URLs (video loops, the résumé) are swapped onto the R2
// media Worker (workers/media), which keeps the same /files/… path, so files
// are served from R2 instead of spending Sanity bandwidth. Image URLs are left
// on cdn.sanity.io for its resizing and hotspots. With NEXT_PUBLIC_MEDIA_URL
// unset, everything stays on Sanity. Setup: docs/Sanity/R2Media.md

// Constants
// ------------
const SANITY_FILES = 'https://cdn.sanity.io/files/';
const MEDIA_FILES = process.env.NEXT_PUBLIC_MEDIA_URL
	? `${process.env.NEXT_PUBLIC_MEDIA_URL.replace(/\/+$/, '')}/files/`
	: null;

// Exports
// ------------
export const toMediaUrl = (url: string): string =>
	MEDIA_FILES && url.startsWith(SANITY_FILES) ? MEDIA_FILES + url.slice(SANITY_FILES.length) : url;

// NOTE • Walks a whole query result, so no GROQ projection has to remember it
export const withMediaUrls = <T>(value: T): T => {
	if (!MEDIA_FILES) return value;
	if (typeof value === 'string') return toMediaUrl(value) as T;
	if (Array.isArray(value)) return value.map(withMediaUrls) as T;
	if (value && typeof value === 'object') {
		return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, withMediaUrls(item)])) as T;
	}
	return value;
};
