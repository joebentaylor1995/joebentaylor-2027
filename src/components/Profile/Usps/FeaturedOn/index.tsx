'use client';

// Imports
// ------------
import { ProfilePresenceContext } from '@parts/ProfileReveal/context';
import { gsap } from 'gsap';
import { use, useEffect, useRef } from 'react';

// Styles
// ------------
import s from './styles.module.scss';

const CROSSFADE_SECONDS = 0.8;
const LOOP_LEAD_SECONDS = 1;

// Component
// ------------
const FeaturedOn = () => {
	// Context
	const profilePresent = use(ProfilePresenceContext);

	// Refs
	const containerRef = useRef<HTMLDivElement>(null);

	// Effects
	useEffect(() => {
		const container = containerRef.current;
		if (!container || !profilePresent) return;
		const videos = Array.from(container.querySelectorAll('video'));
		for (const video of videos) video.src = '/videos/codrops.mp4';
		let active = 0;
		let incoming: number | null = null;
		let fade: gsap.core.Tween | undefined;
		let inView = false;
		let disposed = false;
		const shouldPlay = () => !disposed && inView && !document.hidden;
		gsap.set(videos[0], { opacity: 1, zIndex: 0 });
		gsap.set(videos[1], { opacity: 0, zIndex: 1 });
		const play = (video: HTMLVideoElement) =>
			video.play().then(() => {
				if (!shouldPlay()) video.pause();
			});
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
	}, [profilePresent]);

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
