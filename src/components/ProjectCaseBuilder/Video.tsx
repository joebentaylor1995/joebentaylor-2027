'use client';

// Imports
// ------------
import { observeVideoPlayback } from '@utils/observeVideoPlayback';
import { pickVideoSource } from '@utils/pickVideoSource';
import { useEffect, useRef } from 'react';

// Styles + Interfaces
// ------------
import type { VideoProps } from './interface';

// Component
// ------------
// NOTE • A muted, looping clip that plays only while on screen (observeVideoPlayback)
const Video = ({ media }: VideoProps) => {
	// Refs
	const videoRef = useRef<HTMLVideoElement>(null);

	// Effects
	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		// NOTE • The markup's src is the widest copy. preload='none' fetches nothing,
		// so swapping it here is free
		const source = pickVideoSource(media.src, media.sources, video.clientWidth);
		if (video.getAttribute('src') !== source) video.src = source;
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
	}, [media.src, media.sources]);

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
