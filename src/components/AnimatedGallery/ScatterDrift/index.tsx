'use client';

// Imports
// ------------
import Image from 'next/image';
import { type CSSProperties, useCallback, useMemo, useRef, useState } from 'react';

// Styles + Interfaces
// ------------
import type * as I from '../interface';
import Stage from '../Stage';
import { type GalleryRender, useGalleryLoop } from '../useGalleryLoop';
import { focusOf, MIN_CARDS } from '../utils';
import { buildCards, CARD_ASPECT, CARD_WIDTH, frameFor } from './layout';
import s from './styles.module.scss';

// Constants
// ------------
const CARD_STYLE = { '--card-width': CARD_WIDTH, '--card-aspect': CARD_ASPECT } as CSSProperties;

// Component
// ------------
// One card at a time, tossed off the top as the next rises in from below (layout maths lives in ./layout)
const ScatterDrift = ({ images, background, sizes }: I.GalleryAnimationProps) => {
	// Refs
	const stageRef = useRef<HTMLDivElement>(null);
	const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

	// State
	const [isPaused, setIsPaused] = useState(false);

	// Derived
	const cards = useMemo(() => buildCards(images), [images]);
	const count = Math.max(MIN_CARDS, images.length);

	// Animations
	const render = useCallback<GalleryRender>(
		(elapsed, size) => {
			cards.forEach((card, index) => {
				const element = cardRefs.current[index];
				if (!element) return;
				const frame = frameFor(card, count, elapsed, size);
				// NOTE • Off-stage cards skip their style write and leave the compositor. Visibility is
				// only written when it flips; rewriting it every frame still touched the inline style.
				const visibility = frame.isVisible ? '' : 'hidden';
				if (element.style.visibility !== visibility) element.style.visibility = visibility;
				if (frame.isVisible)
					element.style.transform = `translate3d(0, ${frame.y * size.height}px, 0) rotate(${frame.rotation}deg)`;
			});
		},
		[cards, count]
	);
	useGalleryLoop(stageRef, render, isPaused);

	// Render
	return (
		<Stage
			ref={stageRef}
			background={background}
			isPaused={isPaused}
			onTogglePause={() => setIsPaused(paused => !paused)}
		>
			{cards.map((card, index) => {
				// NOTE • Each image is described once; repeats that pad out a short gallery are decoration
				const isDescribed = card.slot < images.length;
				return (
					<div
						key={card.key}
						ref={element => {
							cardRefs.current[index] = element;
						}}
						className={s.card}
						aria-hidden={!isDescribed || undefined}
						style={{ ...CARD_STYLE, ...focusOf(card.image) }}
					>
						<Image
							src={card.image.src}
							alt={isDescribed ? card.image.alt : ''}
							fill
							sizes={sizes}
							quality={85}
						/>
					</div>
				);
			})}
		</Stage>
	);
};

// Exports
// ------------
ScatterDrift.displayName = 'ScatterDrift';
export default ScatterDrift;
