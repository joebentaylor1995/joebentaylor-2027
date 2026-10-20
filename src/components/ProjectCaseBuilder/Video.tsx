'use client';

// Imports
// ------------
import { observeVideoPlayback } from '@utils/observeVideoPlayback';
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
		// NOTE • Without a poster Sanity can't give the shape up front — take it from
		// the video itself once its metadata loads
		const figure = video.closest('figure');
		const applyAspect = () => {
			if (!figure?.style.getPropertyValue('--media-aspect') && video.videoWidth && video.videoHeight)
				figure?.style.setProperty('--media-aspect', String(video.videoWidth / video.videoHeight));
		};
		applyAspect();
		video.addEventListener('loadedmetadata', applyAspect);
		const stopPlayback = observeVideoPlayback(video);
		return () => {
			stopPlayback();
			video.removeEventListener('loadedmetadata', applyAspect);
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
