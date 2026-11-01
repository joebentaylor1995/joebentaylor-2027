// Imports
// ------------
import { observeScenePause } from './observeScenePause';
import { getYouTubeEmbedUrl } from './youtube';

// Types
// ------------
// Only the slice of the IFrame Player API that this file uses
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

// Constants
// ------------
const PLAYER_API_URL = 'https://www.youtube.com/iframe_api';

// YT.PlayerState values that mean the video is running
const PLAYER_STATE_PLAYING = 1;
const PLAYER_STATE_BUFFERING = 3;

// State
// ------------
let api: Promise<YouTubeApi> | undefined;

// Helpers
// ------------
// Loads the YouTube IFrame API script once and shares the promise between players
const loadPlayerApi = () => {
	if (window.YT?.Player) return Promise.resolve(window.YT);
	api ??= new Promise<YouTubeApi>((resolve, reject) => {
		// Chain any existing ready callback instead of overwriting it
		const previousReady = window.onYouTubeIframeAPIReady;
		window.onYouTubeIframeAPIReady = () => {
			previousReady?.();
			if (window.YT) resolve(window.YT);
		};

		const script = document.createElement('script');
		script.src = PLAYER_API_URL;
		script.onerror = () => {
			api = undefined;
			script.remove();
			reject(new Error('YouTube player API unavailable'));
		};
		document.head.append(script);
	});

	return api;
};

// The embed, with the JS API switched on so it can be paused from here
const createEmbed = (id: string, title: string) => {
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
	return { iframe, src: url.href };
};

// Exports
// ------------
// Called only inside ConsentGate. Keep the standard controls and preserve the
// viewer's playback position; only a previously playing video resumes.
export function mountYouTubePlayer(host: HTMLElement, id: string, title: string) {
	const { iframe, src } = createEmbed(id, title);
	host.append(iframe);

	let player: YouTubePlayer | undefined;
	let ready = false;
	let disposed = false;
	let scenePaused = false;
	let resume = false;
	let apiUnavailable = false;
	let unloaded = false;

	const isCovered = () => scenePaused || document.hidden;

	// Without the API the only way to stop playback is to unload the embed
	const syncEmbedLoaded = () => {
		const covered = isCovered();
		if (covered !== unloaded) {
			unloaded = covered;
			iframe.src = covered ? 'about:blank' : src;
		}
	};

	// Pauses a running video, and later resumes only one that was paused here
	const syncPlayerState = (activePlayer: YouTubePlayer) => {
		if (isCovered()) {
			const state = activePlayer.getPlayerState();
			if (state === PLAYER_STATE_PLAYING || state === PLAYER_STATE_BUFFERING) {
				resume = true;
				activePlayer.pauseVideo();
			}
		} else if (resume) {
			resume = false;
			activePlayer.playVideo();
		}
	};

	// Pauses (and later resumes) the video whenever the scene is covered or the tab hidden
	const syncPlayback = () => {
		if (apiUnavailable) syncEmbedLoaded();
		else if (ready && player) syncPlayerState(player);
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
