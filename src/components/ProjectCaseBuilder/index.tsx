'use client';

// Imports
// ------------
import AnimatedGallery from '@parts/AnimatedGallery';
import BeforeAfter from '@parts/BeforeAfter';
import ModelViewer from '@parts/ModelViewer';
import ParallaxGallery from '@parts/ParallaxGallery';
import { preloadNearbyMedia } from '@utils/preloadNearbyMedia';
import { YOUTUBE_ASPECT } from '@utils/youtube';
import Image from 'next/image';
import { type ComponentType, type CSSProperties, useEffect, useRef, useState } from 'react';
import { BLOCK_ASPECT_RATIOS } from '@/data/projects';

// Styles + Interfaces
// ------------
import type {
	BeforeAfterMediaProps,
	DualMediaProps,
	GalleryMediaProps,
	MediaProps,
	ModelMediaProps,
	ParallaxMediaProps,
	ProjectCaseBuilderProps,
	SingleMediaProps,
} from './interface';
import { mountMediaReveal } from './reveal';
import { MEDIA_REPLAY, MEDIA_SETTINGS_CHANGED } from './settings';
import { DUAL_GALLERY_SIZES, DUAL_SIZES, GALLERY_SIZES, SINGLE_SIZES } from './sizes';
import s from './styles.module.scss';
import Video from './Video';
import YouTube from './YouTube';

// Media tiles
// ------------
// One tile: a figure that holds a video, YouTube embed, image or (in a two-up) an
// animated gallery. The `sizes` strings are the responsive image widths for the
// layout the tile sits in.
const Media = ({ media, sizes }: MediaProps) => {
	// Derived
	// NOTE • Only full-width tiles read this; two-up tiles keep their fixed shape
	const aspect = media.type === 'youtube' ? YOUTUBE_ASPECT : media.type === 'gallery' ? null : media.aspect;
	const style = aspect ? ({ '--media-aspect': aspect } as CSSProperties) : undefined;

	// Render
	return (
		<div className={s.mediaSlot} data-media-tile>
			<figure className={s.media} style={style}>
				{media.type === 'gallery' ? (
					<AnimatedGallery
						animation={media.animation}
						images={media.images}
						background={media.background}
						sizes={DUAL_GALLERY_SIZES}
					/>
				) : media.type === 'video' ? (
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

// Layouts: one full-width tile
export const SingleMedia = ({ media }: SingleMediaProps) => (
	<div className={s.jacket} data-media-layout='single'>
		<Media media={media} sizes={SINGLE_SIZES} />
	</div>
);

// NOTE • Interactive blocks fill a full-width tile in the shape the editor picked
const aspectStyle = (aspect: ParallaxMediaProps['aspect']) =>
	({ '--media-aspect': BLOCK_ASPECT_RATIOS[aspect] }) as CSSProperties;

export const ParallaxMedia = ({ aspect, images }: ParallaxMediaProps) => (
	<div className={s.jacket} data-media-layout='single'>
		<div className={s.mediaSlot} data-media-tile>
			<figure className={s.media} style={aspectStyle(aspect)}>
				<ParallaxGallery images={images} sizes={SINGLE_SIZES} />
			</figure>
		</div>
	</div>
);

export const BeforeAfterMedia = ({ aspect, before, after, start }: BeforeAfterMediaProps) => (
	<div className={s.jacket} data-media-layout='single'>
		<div className={s.mediaSlot} data-media-tile>
			<figure className={s.media} style={aspectStyle(aspect)}>
				<BeforeAfter before={before} after={after} start={start} sizes={SINGLE_SIZES} />
			</figure>
		</div>
	</div>
);

// NOTE • A gallery has no single src, so it's keyed by its first image
const dualKey = (media: DualMediaProps['media'][number]) =>
	media.type === 'gallery' ? `gallery-${media.images[0]?.src}` : media.src;

// Two tiles side by side
export const DualMedia = ({ media }: DualMediaProps) => (
	<div className={s.jacket} data-media-layout='dual'>
		{media.map(item => (
			<Media key={dualKey(item)} media={item} sizes={DUAL_SIZES} />
		))}
	</div>
);

// An animated image gallery in a single tile
export const GalleryMedia = ({ animation, images, background }: GalleryMediaProps) => (
	<div className={s.jacket} data-media-layout='gallery'>
		<div className={s.mediaSlot} data-media-tile>
			<figure className={s.media}>
				<AnimatedGallery animation={animation} images={images} background={background} sizes={GALLERY_SIZES} />
			</figure>
		</div>
	</div>
);

// NOTE • Laid out like a full-width tile, so the poster's shape sets the block's
export const ModelMedia = ({ src, poster, alt, aspect, background }: ModelMediaProps) => (
	<div className={s.jacket} data-media-layout='single'>
		<div className={s.mediaSlot} data-media-tile>
			<figure className={s.media} style={aspect ? ({ '--media-aspect': aspect } as CSSProperties) : undefined}>
				<ModelViewer src={src} poster={poster} alt={alt} background={background} sizes={SINGLE_SIZES} />
			</figure>
		</div>
	</div>
);

// Component
// ------------
// NOTE • Renders a case study's media blocks and plays a clip-path reveal on each tile as
// it scrolls into view (see ./reveal). ?mediaSettings loads a tweak panel for the reveal.
const ProjectCaseBuilder = ({ blocks }: ProjectCaseBuilderProps) => {
	// Refs
	const root = useRef<HTMLElement>(null);

	// State
	const [Settings, setSettings] = useState<ComponentType | null>(null);

	// Effects
	useEffect(() => {
		// Dev only: ?mediaSettings loads the reveal tweak panel on demand
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
		// Warm up media near the viewport
		if (root.current) return preloadNearbyMedia(root.current);
	}, [blocks]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: observe new media elements when CMS blocks change.
	useEffect(() => {
		// Reveal lifecycle: (re)mount the reveal whenever the layout, settings or motion preference change
		const host = root.current;
		if (!host) return;
		const motion = matchMedia('(prefers-reduced-motion: no-preference)');
		let dispose: (() => void) | undefined;
		// Tears down any running reveal, then starts a fresh one unless motion is reduced
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

		// The reveal depends on layout, so rebuild it on resize and when the project layout switches mode
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

	// Render
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
				) : block.type === 'parallax' ? (
					<ParallaxMedia key={block.id} {...block} />
				) : block.type === 'beforeAfter' ? (
					<BeforeAfterMedia key={block.id} {...block} />
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
