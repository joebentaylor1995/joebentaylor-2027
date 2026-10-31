'use client';

// Imports
// ------------
import { ProfilePresenceContext } from '@parts/ProfileReveal/context';
import { gsap } from 'gsap';
import { use, useEffect, useRef } from 'react';

// Styles
// ------------
import s from './styles.module.scss';

// Constants
// ------------
// Seamless loop: two stacked copies of the video; this long before the active one ends, the other
// starts from 0 and fades in over CROSSFADE_SECONDS
const CROSSFADE_SECONDS = 0.8;
const LOOP_LEAD_SECONDS = 1;

// Component
// ------------
// NOTE • video is the loop from the Profile panel's “Featured on” tile
// Autoplaying muted video that loops by crossfading between two <video> elements, only playing while on screen.
const FeaturedOn = ({ video: source }: { video: string }) => {
	// Context
	const profilePresent = use(ProfilePresenceContext);

	// Refs
	const containerRef = useRef<HTMLDivElement>(null);

	// Effects
	useEffect(() => {
		const container = containerRef.current;
		if (!container || !profilePresent) return;

		const videos = Array.from(container.querySelectorAll('video'));
		for (const video of videos) video.src = source;

		// active = index of the video showing; incoming = index fading in (null when no crossfade is running)
		let active = 0;
		let incoming: number | null = null;
		let fade: gsap.core.Tween | undefined;
		let inView = false;
		let disposed = false;

		const shouldPlay = () => !disposed && inView && !document.hidden;

		gsap.set(videos[0], { opacity: 1, zIndex: 0 });
		gsap.set(videos[1], { opacity: 0, zIndex: 1 });

		// Play, then pause again if the tile left the screen while play() was pending
		const play = (video: HTMLVideoElement) =>
			video.play().then(() => {
				if (!shouldPlay()) video.pause();
			});

		// Restart the idle video from the top and fade it in over the active one
		const crossfade = () => {
			if (!shouldPlay() || incoming !== null) return;
			const outgoing = videos[active];
			const nextIndex = 1 - active;
			const next = videos[nextIndex];
			incoming = nextIndex;
			next.currentTime = 0;
			gsap.set(outgoing, { zIndex: 0 });
			gsap.set(next, { opacity: 0, zIndex: 1 });
			void play(next)
				.then(() => {
					if (disposed) return;
					fade = gsap.to(next, {
						opacity: 1,
						duration: CROSSFADE_SECONDS,
						ease: 'none',
						paused: !shouldPlay(),
						onComplete: () => {
							outgoing.pause();
							gsap.set(outgoing, { opacity: 0 });
							active = nextIndex;
							incoming = null;
							fade = undefined;
						},
					});
				})
				.catch(() => {
					incoming = null;
				});
		};

		const checkLoop = () => {
			const video = videos[active];
			if (video.duration - video.currentTime <= LOOP_LEAD_SECONDS) crossfade();
		};

		// Pause everything (including a running fade) when off screen or hidden; resume when back
		const syncPlayback = () => {
			if (!shouldPlay()) {
				for (const video of videos) video.pause();
				fade?.pause();
				return;
			}
			checkLoop();
			if (!videos[active].ended) void play(videos[active]).catch(() => {});
			if (incoming !== null) void play(videos[incoming]).catch(() => {});
			fade?.resume();
		};

		const observer = new IntersectionObserver(([entry]) => {
			inView = entry.isIntersecting;
			syncPlayback();
		});
		observer.observe(container);

		for (const video of videos) {
			video.addEventListener('timeupdate', checkLoop);
			video.addEventListener('ended', checkLoop);
		}
		document.addEventListener('visibilitychange', syncPlayback);

		return () => {
			disposed = true;
			observer.disconnect();
			document.removeEventListener('visibilitychange', syncPlayback);
			fade?.kill();
			for (const video of videos) {
				video.removeEventListener('timeupdate', checkLoop);
				video.removeEventListener('ended', checkLoop);
				video.pause();
				video.removeAttribute('src');
				video.load();
				gsap.set(video, { clearProps: 'opacity,zIndex' });
			}
		};
	}, [profilePresent, source]);

	// Render
	return (
		<div ref={containerRef} className={s.jacket}>
			{[0, 1].map(index => (
				<video
					key={index}
					data-featured-video
					muted
					playsInline
					preload='none'
					aria-hidden='true'
					tabIndex={-1}
				/>
			))}
		</div>
	);
};

// Exports
// ------------
FeaturedOn.displayName = 'FeaturedOn';
export default FeaturedOn;
