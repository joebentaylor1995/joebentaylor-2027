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
import { cubicBezier, focusOf } from '../utils';
import { buildCards, CARD_ASPECT, CARD_WIDTH, radiusFor, TIMING } from './layout';
import s from './styles.module.scss';

// Constants
// ------------
const easeSpin = cubicBezier(TIMING.spin);

// Component
// ------------
const Orbit = ({ images, background, sizes }: I.GalleryAnimationProps) => {
	// Refs
	const stageRef = useRef<HTMLDivElement>(null);
	const ringRef = useRef<HTMLDivElement>(null);

	// State
	const [isPaused, setIsPaused] = useState(false);

	// Derived
	const cards = useMemo(() => buildCards(images), [images]);
	const ringStyle = {
		'--card-width': CARD_WIDTH,
		'--card-aspect': CARD_ASPECT,
		'--radius': radiusFor(cards.length),
	} as CSSProperties;

	// Animations
	// NOTE • The whole ring turns on one property; each card keeps itself upright in CSS
	const render = useCallback<GalleryRender>(elapsed => {
		const loop = (elapsed % TIMING.loop) / TIMING.loop;
		ringRef.current?.style.setProperty('--spin', `${easeSpin(loop) * 360}deg`);
	}, []);
	useGalleryLoop(stageRef, render, isPaused);

	// Render
	return (
		<Stage
			ref={stageRef}
			background={background}
			isPaused={isPaused}
			onTogglePause={() => setIsPaused(paused => !paused)}
		>
			<div ref={ringRef} className={s.ring} style={ringStyle}>
				{cards.map(card => {
					// NOTE • Each image is described once; repeats that pad out a short gallery are decoration
					const isDescribed = card.slot < images.length;
					return (
						<div
							key={card.key}
							className={s.card}
							aria-hidden={!isDescribed || undefined}
							style={
								{
									'--angle': `${card.angle}deg`,
									// NOTE • Each card sits over its anticlockwise neighbour, as in the reference
									zIndex: card.slot + 1,
									...focusOf(card.image),
								} as CSSProperties
							}
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
			</div>
		</Stage>
	);
};

// Exports
// ------------
Orbit.displayName = 'Orbit';
export default Orbit;
