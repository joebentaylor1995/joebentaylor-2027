'use client';

// Imports
// ------------
import ConsentGate from '@parts/ConsentGate';
import { getYouTubeEmbedUrl, getYouTubeId, getYouTubeThumbnail, YOUTUBE_ORIGIN } from '@utils/youtube';
import Image from 'next/image';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

// Styles + Interfaces
// ------------
import type { YouTubePlayerProps, YouTubeProps } from './interface';
import s from './styles.module.scss';

// Constants
// ------------
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const PLAYING = 1;
const PAUSED = 2;
// NOTE • Seek back to the start this long before the end, so YouTube's end
// screen never gets a frame — its own `loop` is the fallback
const LOOP_LEAD_SECONDS = 0.6;
const HANDSHAKE_INTERVAL_MS = 250;
const HANDSHAKE_ATTEMPTS = 40;

// Helpers
// ------------
const subscribeMotion = (callback: () => void) => {
	const query = matchMedia(REDUCED_MOTION);
	query.addEventListener('change', callback);
	return () => query.removeEventListener('change', callback);
};
const getMotionSnapshot = () => matchMedia(REDUCED_MOTION).matches;
// NOTE • Assume reduced motion on the server, so the player only mounts client-side
const getServerMotionSnapshot = () => true;

type PlayerMessage = {
	event?: string;
	info?: number | { playerState?: number; currentTime?: number; duration?: number } | null;
};

const postCommand = (frame: HTMLIFrameElement | null, func: string, args: unknown[] = []) =>
	frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), YOUTUBE_ORIGIN);

const parseMessage = (data: unknown): PlayerMessage | null => {
	try {
		return typeof data === 'string' ? (JSON.parse(data) as PlayerMessage) : null;
	} catch {
		return null;
	}
};

// Player
// ------------
// NOTE • Talks to the embed over YouTube's postMessage API directly (no
// iframe_api script). Hidden until it's actually playing, so the title bar and
// play button never show; paused off-screen and in background tabs.
const Player = ({ id, title }: YouTubePlayerProps) => {
	// Refs
	const frameRef = useRef<HTMLIFrameElement>(null);
	const isUserPaused = useRef(false);

	// State
	const [state, setState] = useState<'loading' | 'playing' | 'paused'>('loading');

	// Derived
	const [origin] = useState(() => location.origin);

	// Handlers
	const handleToggle = () => {
		isUserPaused.current = state === 'playing';
		postCommand(frameRef.current, isUserPaused.current ? 'pauseVideo' : 'playVideo');
	};

	// Effects
	useEffect(() => {
		const frame = frameRef.current;
		if (!frame) return;
		let isConnected = false;
		let isVisible = false;
		let attempts = 0;

		// NOTE • The player only reports back once it's been asked to listen
		const handshake = setInterval(() => {
			if (isConnected || ++attempts > HANDSHAKE_ATTEMPTS) return clearInterval(handshake);
			frame.contentWindow?.postMessage(
				JSON.stringify({ event: 'listening', id, channel: 'widget' }),
				YOUTUBE_ORIGIN
			);
		}, HANDSHAKE_INTERVAL_MS);

		const syncPlayback = () => {
			if (!isConnected || isUserPaused.current) return;
			postCommand(frame, isVisible && !document.hidden ? 'playVideo' : 'pauseVideo');
		};

		const handleMessage = (event: MessageEvent) => {
			if (event.origin !== YOUTUBE_ORIGIN || event.source !== frame.contentWindow) return;
			const message = parseMessage(event.data);
			if (!message) return;
			if (!isConnected) {
				isConnected = true;
				// NOTE • Visibility may have been decided before the player could hear it
				syncPlayback();
			}
			const info = message.info;
			const playerState = typeof info === 'number' ? info : info?.playerState;
			if (playerState === PLAYING) setState('playing');
			else if (playerState === PAUSED) setState(current => (current === 'loading' ? current : 'paused'));
			if (typeof info === 'object' && info?.currentTime && info.duration) {
				if (info.currentTime >= info.duration - LOOP_LEAD_SECONDS) postCommand(frame, 'seekTo', [0, true]);
			}
		};

		const observer = new IntersectionObserver(([entry]) => {
			isVisible = entry.isIntersecting;
			syncPlayback();
		});
		observer.observe(frame);
		window.addEventListener('message', handleMessage);
		document.addEventListener('visibilitychange', syncPlayback);
		return () => {
			clearInterval(handshake);
			observer.disconnect();
			window.removeEventListener('message', handleMessage);
			document.removeEventListener('visibilitychange', syncPlayback);
		};
	}, [id]);

	// Render
	return (
		<>
			<iframe
				ref={frameRef}
				className={s.youtubePlayer}
				src={getYouTubeEmbedUrl(id, origin)}
				title={title}
				allow='autoplay; encrypted-media; picture-in-picture'
				loading='lazy'
				tabIndex={-1}
				aria-hidden
				data-state={state}
			/>
			{state !== 'loading' && (
				<button
					type='button'
					className={s.youtubeToggle}
					onClick={handleToggle}
					aria-label={state === 'playing' ? `Pause ${title}` : `Play ${title}`}
					data-state={state}
				>
					<span data-type='captionL'>{state === 'playing' ? 'Pause' : 'Play'}</span>
				</button>
			)}
		</>
	);
};

// Component
// ------------
const YouTube = ({ media, sizes }: YouTubeProps) => {
	// State
	const [thumbnail, setThumbnail] = useState<'maxresdefault' | 'hqdefault'>('maxresdefault');
	const isReduced = useSyncExternalStore(subscribeMotion, getMotionSnapshot, getServerMotionSnapshot);

	// Derived
	const id = getYouTubeId(media.src);
	if (!id) return null;

	// Render
	return (
		<>
			{/* NOTE • The frame is YouTube's 16:9 player, scaled so the 16:10
			recording inside it covers the tile and the pillarbox bars fall
			outside the crop. The still shows until the player is playing, and
			instead of it without marketing consent or with reduced motion. */}
			<div className={s.youtube}>
				<Image
					src={getYouTubeThumbnail(id, thumbnail)}
					alt={media.alt}
					fill
					sizes={sizes}
					onError={() => setThumbnail('hqdefault')}
				/>
			</div>
			{!isReduced && (
				<ConsentGate category='marketing'>
					<Player id={id} title={media.alt} />
				</ConsentGate>
			)}
		</>
	);
};

// Exports
// ------------
export default YouTube;
