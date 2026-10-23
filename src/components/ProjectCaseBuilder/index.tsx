'use client';

import AnimatedGallery from '@parts/AnimatedGallery';
import ModelViewer from '@parts/ModelViewer';
import { preloadNearbyMedia } from '@utils/preloadNearbyMedia';
import { YOUTUBE_ASPECT } from '@utils/youtube';
// Imports
// ------------
import Image from 'next/image';
import { type ComponentType, type CSSProperties, useEffect, useRef, useState } from 'react';
// Styles + Interfaces
// ------------
import type {
	DualMediaProps,
	GalleryMediaProps,
	MediaProps,
	ModelMediaProps,
	ProjectCaseBuilderProps,
	SingleMediaProps,
} from './interface';
import { mountMediaReveal } from './reveal';
import { MEDIA_REPLAY, MEDIA_SETTINGS_CHANGED } from './settings';
import s from './styles.module.scss';
import Video from './Video';
import YouTube from './YouTube';

// Component
// ------------
const Media = ({ media, sizes }: MediaProps) => {
	// Derived
	// NOTE • Only full-width tiles read this; two-up tiles keep their fixed shape
	const aspect = media.type === 'youtube' ? YOUTUBE_ASPECT : media.aspect;
	const style = aspect ? ({ '--media-aspect': aspect } as CSSProperties) : undefined;

	// Render
	return (
		<div className={s.mediaSlot} data-media-tile>
			<figure className={s.media} style={style}>
				{media.type === 'video' ? (
					<Video key={media.src} media={media} />
				) : media.type === 'youtube' ? (
					<YouTube key={media.src} media={media} sizes={sizes} />
				) : (
					<Image src={media.src} alt={media.alt} fill sizes={sizes} quality={90} />
				)}
			</figure>
		</div>
	);
};

export const SingleMedia = ({ media }: SingleMediaProps) => (
	<div className={s.jacket} data-media-layout='single'>
		<Media
			media={media}
			sizes='(max-width: 1023px) calc(100vw - 32px), (max-width: 1440px) calc(67.65vw - 80px), 894px'
		/>
	</div>
);

export const DualMedia = ({ media }: DualMediaProps) => (
	<div className={s.jacket} data-media-layout='dual'>
		{media.map(item => (
			<Media
				key={item.src}
				media={item}
				sizes='(max-width: 1023px) calc(100vw - 32px), (max-width: 1440px) calc(33.825vw - 44px), 443px'
			/>
		))}
	</div>
);

export const GalleryMedia = ({ animation, images, background }: GalleryMediaProps) => (
	<div className={s.jacket} data-media-layout='gallery'>
		<div className={s.mediaSlot} data-media-tile>
			<figure className={s.media}>
				<AnimatedGallery
					animation={animation}
					images={images}
					background={background}
					sizes='(max-width: 1023px) 60vw, (max-width: 1440px) 40vw, 560px'
				/>
			</figure>
		</div>
	</div>
);

// NOTE • Laid out like a full-width tile, so the poster's shape sets the block's
export const ModelMedia = ({ src, poster, alt, aspect, background }: ModelMediaProps) => (
	<div className={s.jacket} data-media-layout='single'>
		<div className={s.mediaSlot} data-media-tile>
			<figure className={s.media} style={aspect ? ({ '--media-aspect': aspect } as CSSProperties) : undefined}>
				<ModelViewer
					src={src}
					poster={poster}
					alt={alt}
					background={background}
					sizes='(max-width: 1023px) calc(100vw - 32px), (max-width: 1440px) calc(67.65vw - 80px), 894px'
				/>
			</figure>
		</div>
	</div>
);

const ProjectCaseBuilder = ({ blocks }: ProjectCaseBuilderProps) => {
	const root = useRef<HTMLElement>(null);
	const [Settings, setSettings] = useState<ComponentType | null>(null);
	useEffect(() => {
		if (!new URLSearchParams(location.search).has('mediaSettings')) return;
		let disposed = false;
		void import('./Settings/index').then(module => {
			if (!disposed) setSettings(() => module.default);
		});
		return () => {
			disposed = true;
		};
	}, []);
	// biome-ignore lint/correctness/useExhaustiveDependencies: CMS replacement installs new media elements.
	useEffect(() => {
		if (root.current) return preloadNearbyMedia(root.current);
	}, [blocks]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: observe new media elements when CMS blocks change.
	useEffect(() => {
		const host = root.current;
		if (!host) return;
		const motion = matchMedia('(prefers-reduced-motion: no-preference)');
		let dispose: (() => void) | undefined;
		const setup = () => {
			dispose?.();
			dispose = undefined;
			if (!motion.matches) return;
			dispose = mountMediaReveal(host);
		};
		// NOTE • A project modal stays mounted (hidden) between visits, so its tiles
		// keep their revealed state — clear it so every opening plays the reveal.
		// This effect re-runs when the hidden modal is shown again; resizes and
		// settings changes go through setup() and still keep finished reveals.
		if (host.closest('[data-project-modal]'))
			for (const tile of host.querySelectorAll<HTMLElement>('[data-media-tile]'))
				delete tile.dataset.revealComplete;
		void setup();
		const replay = () => {
			dispose?.();
			dispose = undefined;
			for (const tile of host.querySelectorAll<HTMLElement>('[data-media-tile]'))
				delete tile.dataset.revealComplete;
			setup();
		};
		window.addEventListener(MEDIA_SETTINGS_CHANGED, setup);
		window.addEventListener(MEDIA_REPLAY, replay);
		window.addEventListener('resize', setup);
		const experience = host.closest('[data-project-experience]');
		const layout = new MutationObserver(setup);
		if (experience) layout.observe(experience, { attributes: true, attributeFilter: ['data-enhanced'] });
		motion.addEventListener('change', setup);
		return () => {
			window.removeEventListener(MEDIA_SETTINGS_CHANGED, setup);
			window.removeEventListener(MEDIA_REPLAY, replay);
			window.removeEventListener('resize', setup);
			layout.disconnect();
			motion.removeEventListener('change', setup);
			dispose?.();
		};
	}, [blocks]);
	return (
		<section ref={root} className={s.jacket} data-project-case-builder aria-label='Project case study media'>
			{Settings && <Settings />}
			{blocks.map(block =>
				block.type === 'single' ? (
					<SingleMedia key={block.id} media={block.media} />
				) : block.type === 'dual' ? (
					<DualMedia key={block.id} media={block.media} />
				) : block.type === 'model' ? (
					<ModelMedia key={block.id} {...block} />
				) : (
					<GalleryMedia key={block.id} {...block} />
				)
			)}
		</section>
	);
};

// Exports
// ------------
export default ProjectCaseBuilder;
