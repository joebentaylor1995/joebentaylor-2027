'use client';

// Imports
// ------------
import ConsentGate from '@parts/ConsentGate';
import { openCookieSettings } from '@parts/CookieBar/consent';
import { getYouTubeId, getYouTubeThumbnail, type YouTubeThumbnailSize } from '@utils/youtube';
import Image from 'next/image';
import { useState } from 'react';

// Styles + Interfaces
// ------------
import type { YouTubeProps } from './interface';
import s from './styles.module.scss';
import YouTubePlayer from './YouTubePlayer';

// Component
// ------------
// NOTE • YouTube's standard player, behind marketing consent. Until then the
// video's thumbnail shows, with a way into the cookie settings.
const YouTube = ({ media, sizes }: YouTubeProps) => {
	// State
	const [thumbnail, setThumbnail] = useState<YouTubeThumbnailSize>('maxresdefault');

	// Derived
	const id = getYouTubeId(media.src);
	if (!id) return null;

	// Render
	return (
		<ConsentGate
			category='marketing'
			fallback={
				<>
					<Image
						src={getYouTubeThumbnail(id, thumbnail)}
						alt={media.alt}
						fill
						sizes={sizes}
						onError={() => setThumbnail('hqdefault')}
					/>
					<button type='button' className={s.youtubeConsent} onClick={openCookieSettings}>
						<span data-type='captionL'>Allow marketing cookies to play</span>
					</button>
				</>
			}
		>
			<YouTubePlayer id={id} title={media.alt} />
		</ConsentGate>
	);
};

// Exports
// ------------
export default YouTube;
