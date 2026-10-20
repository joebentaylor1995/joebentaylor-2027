import { observeScenePause } from './observeScenePause';
import { getYouTubeEmbedUrl } from './youtube';

interface YouTubePlayer {
	getPlayerState(): number;
	pauseVideo(): void;
	playVideo(): void;
	destroy(): void;
}
interface YouTubeApi {
	Player: new (
		iframe: HTMLIFrameElement,
		options: { events: { onReady: () => void; onStateChange: () => void } }
	) => YouTubePlayer;
}
declare global {
	interface Window {
		YT?: YouTubeApi;
		onYouTubeIframeAPIReady?: () => void;
	}
}

let api: Promise<YouTubeApi> | undefined;
const loadPlayerApi = () => {
	if (window.YT?.Player) return Promise.resolve(window.YT);
	api ??= new Promise<YouTubeApi>((resolve, reject) => {
		const previousReady = window.onYouTubeIframeAPIReady;
		window.onYouTubeIframeAPIReady = () => {
			previousReady?.();
			if (window.YT) resolve(window.YT);
		};
		const script = document.createElement('script');
		script.src = 'https://www.youtube.com/iframe_api';
		script.onerror = () => {
			api = undefined;
			script.remove();
			reject(new Error('YouTube player API unavailable'));
		};
		document.head.append(script);
	});
	return api;
};

// Called only inside ConsentGate. Keep the standard controls and preserve the
// viewer's playback position; only a previously playing video resumes.
export function mountYouTubePlayer(host: HTMLElement, id: string, title: string) {
	const iframe = document.createElement('iframe');
	const url = new URL(getYouTubeEmbedUrl(id));
	url.searchParams.set('enablejsapi', '1');
	url.searchParams.set('origin', location.origin);
	iframe.src = url.href;
	iframe.title = title;
	iframe.allow =
		'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
	iframe.allowFullscreen = true;
	iframe.loading = 'lazy';
	host.append(iframe);
	let player: YouTubePlayer | undefined;
	let ready = false;
	let disposed = false;
	let scenePaused = false;
	let resume = false;
	let apiUnavailable = false;
	let unloaded = false;
	const syncPlayback = () => {
		if (apiUnavailable) {
			const paused = scenePaused || document.hidden;
			if (paused !== unloaded) {
				unloaded = paused;
				iframe.src = paused ? 'about:blank' : url.href;
			}
			return;
		}
		if (!ready || !player) return;
		if (scenePaused || document.hidden) {
			const state = player.getPlayerState();
			if (state === 1 || state === 3) {
				resume = true;
				player.pauseVideo();
			}
		} else if (resume) {
			resume = false;
			player.playVideo();
		}
	};
	const stopObserving = observeScenePause(host, paused => {
		scenePaused = paused;
		syncPlayback();
	});
	document.addEventListener('visibilitychange', syncPlayback);
	void loadPlayerApi()
		.then(YT => {
			if (disposed) return;
			player = new YT.Player(iframe, {
				events: {
					onReady: () => {
						ready = true;
						syncPlayback();
					},
					onStateChange: syncPlayback,
				},
			});
		})
		.catch(() => {
			if (disposed) return;
			// Even if the API is blocked, a covered embed must not keep playing.
			apiUnavailable = true;
			syncPlayback();
		});
	return () => {
		disposed = true;
		stopObserving();
		document.removeEventListener('visibilitychange', syncPlayback);
		player?.destroy();
		iframe.remove();
	};
}
