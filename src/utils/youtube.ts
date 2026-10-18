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

export const YOUTUBE_ORIGIN = 'https://www.youtube-nocookie.com';

// NOTE • Muted, looping and chromeless — `playlist` set to the same video is
// what makes a single embed loop. Pass the page's origin to switch on the
// player's postMessage API (play/pause, state), as the site player does.
export const getYouTubeEmbedUrl = (id: string, origin?: string) =>
	`${YOUTUBE_ORIGIN}/embed/${id}?${new URLSearchParams({
		autoplay: '1',
		mute: '1',
		loop: '1',
		playlist: id,
		controls: '0',
		playsinline: '1',
		disablekb: '1',
		rel: '0',
		iv_load_policy: '3',
		fs: '0',
		...(origin && { enablejsapi: '1', origin }),
	})}`;

// NOTE • The shape of the recordings (not YouTube's 16:9 player) — full-width
// tiles take it, and the player is scaled to crop to it (ProjectCaseBuilder styles)
export const YOUTUBE_ASPECT = 16 / 10;

// NOTE • maxresdefault is 16:9 but missing on some (older, low-res) videos;
// hqdefault always exists but is 4:3 with letterboxing — use it as the fallback
export type YouTubeThumbnailSize = 'maxresdefault' | 'hqdefault';
export const getYouTubeThumbnail = (id: string, size: YouTubeThumbnailSize = 'maxresdefault') =>
	`https://i.ytimg.com/vi/${id}/${size}.jpg`;
