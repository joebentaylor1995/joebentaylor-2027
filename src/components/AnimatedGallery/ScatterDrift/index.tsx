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
import { cubicBezier, focusOf, MIN_CARDS } from '../utils';
import { buildCards, CARD_ASPECT, CARD_WIDTH, frameFor, TIMING } from './layout';
import s from './styles.module.scss';

// Constants
// ------------
const easePosition = cubicBezier(TIMING.position);
const easeRotation = cubicBezier(TIMING.rotation);
const CARD_STYLE = { '--card-width': CARD_WIDTH, '--card-aspect': CARD_ASPECT } as CSSProperties;

// Component
// ------------
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
	// NOTE • Whole steps plus the eased part of the current one — every step is all motion
	const render = useCallback<GalleryRender>(
		(elapsed, size) => {
			const steps = elapsed / TIMING.step;
			const step = Math.floor(steps);
			const progress = {
				position: step + easePosition(steps - step),
				rotation: step + easeRotation(steps - step),
			};
			cards.forEach((card, index) => {
				const element = cardRefs.current[index];
				if (!element) return;
				const frame = frameFor(card, count, progress, size);
				// NOTE • Off-stage cards skip their style write and leave the compositor
				element.style.visibility = frame.isVisible ? '' : 'hidden';
				if (frame.isVisible)
					element.style.transform = `translate3d(${frame.x}px, ${frame.y}px, 0) rotate(${frame.rotation}deg)`;
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
				// NOTE • Each image is described once; side-lane and repeat cards are decoration
				const isDescribed = card.isHero && card.slot < images.length;
				return (
					<div
						key={card.key}
						ref={element => {
							cardRefs.current[index] = element;
						}}
						className={s.card}
						data-lane={card.isHero ? 'hero' : 'side'}
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
