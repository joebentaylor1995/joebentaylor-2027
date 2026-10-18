'use client';

// Imports
// ------------
import { useEffect, useRef } from 'react';

// Styles + Interfaces
// ------------
import type { VideoProps } from './interface';

// Component
// ------------
const Video = ({ media }: VideoProps) => {
	// Refs
	const videoRef = useRef<HTMLVideoElement>(null);

	// Effects
	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		if (video.getAttribute('src') !== media.src) video.src = media.src;
		let visible = false;
		let disposed = false;
		const motion = matchMedia('(prefers-reduced-motion: reduce)');
		const scene = video.closest<HTMLElement>('[data-profile-scene]');
		const canPlay = () =>
			visible && !document.hidden && !disposed && !motion.matches && scene?.dataset.scenePaused !== 'true';
		const updatePlayback = () => {
			if (canPlay()) {
				void video
					.play()
					.then(() => {
						// Playback may resolve after the slide leaves the viewport.
						if (!canPlay()) video.pause();
					})
					.catch(() => {
						/* Browser autoplay restrictions leave the poster visible. */
					});
			} else video.pause();
		};
		const observer = new IntersectionObserver(
			([entry]) => {
				visible = entry.isIntersecting && entry.intersectionRatio >= 0.05;
				updatePlayback();
			},
			{ threshold: [0, 0.05] }
		);
		observer.observe(video);
		const covered = new MutationObserver(updatePlayback);
		if (scene) covered.observe(scene, { attributes: true, attributeFilter: ['data-scene-paused'] });
		document.addEventListener('visibilitychange', updatePlayback);
		motion.addEventListener('change', updatePlayback);
		return () => {
			disposed = true;
			observer.disconnect();
			covered.disconnect();
			document.removeEventListener('visibilitychange', updatePlayback);
			motion.removeEventListener('change', updatePlayback);
			video.pause();
			video.removeAttribute('src');
			video.load();
		};
	}, [media.src]);

	// Render
	return (
		<video
			ref={videoRef}
			crossOrigin='anonymous'
			src={media.src}
			poster={media.poster ?? undefined}
			aria-label={media.alt}
			muted
			loop
			playsInline
			preload='none'
		/>
	);
};

// Exports
// ------------
export default Video;
