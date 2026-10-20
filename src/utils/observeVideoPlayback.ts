import { observeScenePause } from './observeScenePause';

// Autoplay only while a video is visible on the uncovered page. Recheck after
// play() resolves because media decoding can finish after the modal opens.
export function observeVideoPlayback(video: HTMLVideoElement) {
	let visible = false;
	let disposed = false;
	let scenePaused = false;
	const motion = matchMedia('(prefers-reduced-motion: reduce)');
	const canPlay = () => visible && !document.hidden && !disposed && !motion.matches && !scenePaused;
	const updatePlayback = () => {
		if (canPlay()) {
			void video
				.play()
				.then(() => {
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
	const stopObserving = observeScenePause(video, paused => {
		scenePaused = paused;
		updatePlayback();
	});
	document.addEventListener('visibilitychange', updatePlayback);
	motion.addEventListener('change', updatePlayback);
	return () => {
		disposed = true;
		observer.disconnect();
		stopObserving();
		document.removeEventListener('visibilitychange', updatePlayback);
		motion.removeEventListener('change', updatePlayback);
		video.pause();
	};
}
