'use client';

// Imports
// ------------
import { mountYouTubePlayer } from '@utils/youtubePlayer';
import { useEffect, useRef } from 'react';

// Styles + Interfaces
// ------------
import type { YouTubePlayerProps } from './interface';
import s from './styles.module.scss';

// Component
// ------------
const YouTubePlayer = ({ id, title }: YouTubePlayerProps) => {
	// Refs
	const host = useRef<HTMLDivElement>(null);

	// Effects
	useEffect(() => {
		if (host.current) return mountYouTubePlayer(host.current, id, title);
	}, [id, title]);

	// Render
	return <div ref={host} className={s.youtube} />;
};

// Exports
// ------------
export default YouTubePlayer;
