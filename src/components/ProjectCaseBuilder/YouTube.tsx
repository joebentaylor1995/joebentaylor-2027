'use client';

// Imports
// ------------
import ConsentGate from '@parts/ConsentGate';
import { getYouTubeEmbedUrl, getYouTubeId, getYouTubeThumbnail } from '@utils/youtube';
import Image from 'next/image';
import { useState, useSyncExternalStore } from 'react';

// Styles + Interfaces
// ------------
import type { YouTubeProps } from './interface';
import s from './styles.module.scss';

// Helpers
// ------------
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const subscribeMotion = (callback: () => void) => {
	const query = matchMedia(REDUCED_MOTION);
	query.addEventListener('change', callback);
	return () => query.removeEventListener('change', callback);
};
const getMotionSnapshot = () => matchMedia(REDUCED_MOTION).matches;
// NOTE • Assume reduced motion on the server, so the player only mounts client-side
const getServerMotionSnapshot = () => true;

// Component
// ------------
const YouTube = ({ media, sizes }: YouTubeProps) => {
	// State
	const [thumbnail, setThumbnail] = useState<'maxresdefault' | 'hqdefault'>('maxresdefault');
	const [isReady, setIsReady] = useState(false);
	const isReduced = useSyncExternalStore(subscribeMotion, getMotionSnapshot, getServerMotionSnapshot);

	// Derived
	const id = getYouTubeId(media.src);
	if (!id) return null;

	// Render
	return (
		<>
			{/* NOTE • The still: shown until the player is ready, and instead of it
			without marketing consent or with reduced motion */}
			<Image
				src={getYouTubeThumbnail(id, thumbnail)}
				alt={media.alt}
				fill
				sizes={sizes}
				onError={() => setThumbnail('hqdefault')}
			/>
			{!isReduced && (
				<ConsentGate category='marketing'>
					<iframe
						className={s.youtube}
						src={getYouTubeEmbedUrl(id)}
						title={media.alt}
						allow='autoplay; encrypted-media; picture-in-picture'
						loading='lazy'
						tabIndex={-1}
						aria-hidden
						data-state={isReady ? 'ready' : 'loading'}
						onLoad={() => setIsReady(true)}
					/>
				</ConsentGate>
			)}
		</>
	);
};

// Exports
// ------------
export default YouTube;
