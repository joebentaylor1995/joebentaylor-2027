// YouTube
// ------------
// NOTE • Shared by the Studio (validation + preview) and the site, so a link
// that previews in Sanity is exactly the one that plays on the page.

const VIDEO_ID = /^[\w-]{11}$/;
const HOSTS = [
	'youtube.com',
	'www.youtube.com',
	'm.youtube.com',
	'music.youtube.com',
	'youtube-nocookie.com',
	'www.youtube-nocookie.com',
];

// NOTE • Accepts watch, youtu.be, shorts, live and embed links
export const getYouTubeId = (url: string | null | undefined): string | null => {
	if (!url) return null;
	try {
		const { hostname, pathname, searchParams } = new URL(url.trim());
		const [first, second] = pathname.split('/').filter(Boolean);
		const id =
			hostname === 'youtu.be'
				? first
				: HOSTS.includes(hostname)
					? (searchParams.get('v') ??
						(['shorts', 'live', 'embed'].includes(first ?? '') ? second : undefined))
					: undefined;
		return id && VIDEO_ID.test(id) ? id : null;
	} catch {
		return null;
	}
};

// NOTE • YouTube's standard player — its own controls, thumbnail and play
// button, nothing overridden
export const getYouTubeEmbedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}`;

// NOTE • The player's shape — full-width tiles take it
export const YOUTUBE_ASPECT = 16 / 9;

// NOTE • maxresdefault is 16:9 but missing on some (older, low-res) videos;
// hqdefault always exists but is 4:3 with letterboxing — use it as the fallback
export type YouTubeThumbnailSize = 'maxresdefault' | 'hqdefault';
export const getYouTubeThumbnail = (id: string, size: YouTubeThumbnailSize = 'maxresdefault') =>
	`https://i.ytimg.com/vi/${id}/${size}.jpg`;
