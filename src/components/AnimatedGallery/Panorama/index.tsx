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
import { angleFor, buildCards, CARD_ASPECT, CARD_WIDTH, isOnStage, PARALLAX_SCALE, slideFor, TIMING } from './layout';
import s from './styles.module.scss';

// Constants
// ------------
const easeTurn = cubicBezier(TIMING.turn);
const HOLD = TIMING.step - TIMING.move;
const CARD_STYLE = {
	'--card-width': CARD_WIDTH,
	'--card-aspect': CARD_ASPECT,
	'--parallax-scale': PARALLAX_SCALE,
} as CSSProperties;

// Component
// ------------
const Panorama = ({ images, background, sizes }: I.GalleryAnimationProps) => {
	// Refs
	const stageRef = useRef<HTMLDivElement>(null);
	const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

	// State
	const [isPaused, setIsPaused] = useState(false);

	// Derived
	const cards = useMemo(() => buildCards(images), [images]);
	const count = Math.max(MIN_CARDS, images.length);

	// Animations
	// NOTE • Each step rests on a card, then turns the ring one card along
	const render = useCallback<GalleryRender>(
		elapsed => {
			const step = Math.floor(elapsed / TIMING.step);
			const turn = (elapsed - step * TIMING.step - HOLD) / TIMING.move;
			const progress = step + easeTurn(Math.min(1, Math.max(0, turn)));
			cards.forEach((card, index) => {
				const element = cardRefs.current[index];
				if (!element) return;
				const angle = angleFor(card, count, progress);
				const isVisible = isOnStage(angle);
				// NOTE • Off-stage cards skip their style write and leave the compositor
				element.style.visibility = isVisible ? '' : 'hidden';
				if (!isVisible) return;
				element.style.setProperty('--turn', `${-angle}deg`);
				element.style.setProperty('--slide', `${slideFor(angle)}%`);
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
			<div className={s.scene}>
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
							<div className={s.media}>
								<Image
									src={card.image.src}
									alt={isDescribed ? card.image.alt : ''}
									fill
									sizes={sizes}
									quality={85}
								/>
							</div>
						</div>
					);
				})}
			</div>
		</Stage>
	);
};

// Exports
// ------------
Panorama.displayName = 'Panorama';
export default Panorama;
