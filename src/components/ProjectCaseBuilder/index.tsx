'use client';

import { mediaScrollRoot, preloadNearbyMedia } from '@utils/preloadNearbyMedia';
// Imports
// ------------
import Image from 'next/image';
import { useEffect, useRef } from 'react';
// Styles + Interfaces
// ------------
import type { DualMediaProps, MediaProps, ProjectCaseBuilderProps, SingleMediaProps } from './interface';
import s from './styles.module.scss';
import Video from './Video';

// Component
// ------------
const Media = ({ media, sizes }: MediaProps) => {
	return (
		<div className={s.mediaSlot} data-media-tile>
			<figure className={s.media}>
				{media.type === 'video' ? (
					<Video key={media.src} media={media} />
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

const ProjectCaseBuilder = ({ blocks }: ProjectCaseBuilderProps) => {
	const root = useRef<HTMLElement>(null);
	const canvas = useRef<HTMLCanvasElement>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: CMS replacement installs new media elements.
	useEffect(() => {
		if (root.current) return preloadNearbyMedia(root.current);
	}, [blocks]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: rebuild tile textures when CMS blocks change.
	useEffect(() => {
		const host = root.current;
		const surface = canvas.current;
		if (!host || !surface) return;
		const motion = matchMedia('(prefers-reduced-motion: no-preference)');
		let generation = 0;
		let dispose: (() => void) | undefined;
		let preload: IntersectionObserver | undefined;
		const setup = () => {
			const request = ++generation;
			preload?.disconnect();
			dispose?.();
			dispose = undefined;
			if (!motion.matches) return;
			preload = new IntersectionObserver(
				entries => {
					if (!entries.some(entry => entry.isIntersecting)) return;
					preload?.disconnect();
					void import('./reveal')
						.then(({ mountMediaReveal }) => {
							if (request === generation) dispose = mountMediaReveal(host, surface);
						})
						.catch(() => {
							// Native media remains visible if the optional renderer cannot load.
						});
				},
				{ root: mediaScrollRoot(host), rootMargin: `${innerHeight}px 0px` }
			);
			preload.observe(host);
		};
		void setup();
		const experience = host.closest('[data-project-experience]');
		const layout = new MutationObserver(setup);
		if (experience) layout.observe(experience, { attributes: true, attributeFilter: ['data-enhanced'] });
		motion.addEventListener('change', setup);
		return () => {
			generation++;
			preload?.disconnect();
			layout.disconnect();
			motion.removeEventListener('change', setup);
			dispose?.();
		};
	}, [blocks]);
	return (
		<section ref={root} className={s.jacket} data-project-case-builder aria-label='Project case study media'>
			{blocks.map(block =>
				block.type === 'single' ? (
					<SingleMedia key={block.id} media={block.media} />
				) : (
					<DualMedia key={block.id} media={block.media} />
				)
			)}
			<canvas ref={canvas} className={s.revealCanvas} tabIndex={-1} aria-hidden='true' data-media-reveal />
		</section>
	);
};

// Exports
// ------------
export default ProjectCaseBuilder;
