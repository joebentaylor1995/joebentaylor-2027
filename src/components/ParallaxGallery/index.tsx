'use client';

// Imports
// ------------
import { useAnimation } from '@utils/useAnimation';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { Observer } from 'gsap/Observer';
import Image from 'next/image';
import { type CSSProperties, useRef } from 'react';

// Styles + Interfaces
// ------------
import type * as I from './interface';
import s from './styles.module.scss';

// Constants
// ------------
// NOTE • Osmo "Parallax Image Gallery with Thumbnails": each slide wipes across while
// its image moves the other way at half the distance, on the resource's own curve
gsap.registerPlugin(Observer, CustomEase);
CustomEase.create('slideshow-wipe', '0.6, 0.08, 0.02, 0.99');
const ANIMATION_DURATION = 0.9;
const PARALLAX = 50;
// NOTE • Phones have no thumbnails, so the slideshow plays itself until the visitor swipes
const AUTOPLAY_SECONDS = 4;
const WHEEL_THRESHOLD = 50;

const focusStyle = (image: I.ParallaxGalleryProps['images'][number]) =>
	image.hotspot ? ({ '--focus': `${image.hotspot.x * 100}% ${image.hotspot.y * 100}%` } as CSSProperties) : undefined;

// Component
// ------------
const ParallaxGallery = ({ images, sizes }: I.ParallaxGalleryProps) => {
	// Refs
	const wrapRef = useRef<HTMLDivElement>(null);
	// NOTE • Survives breakpoint changes, which rebuild the animation context
	const currentRef = useRef(0);
	const hasSwipedRef = useRef(false);

	// Animations
	useAnimation(
		({ isMobile }) => {
			const el = wrapRef.current;
			if (!el) return;
			const ui = {
				slides: Array.from(el.querySelectorAll<HTMLElement>('[data-slideshow="slide"]')),
				inner: Array.from(el.querySelectorAll<HTMLElement>('[data-slideshow="parallax"]')),
				thumbs: Array.from(el.querySelectorAll<HTMLElement>('[data-slideshow="thumb"]')),
			};
			const length = ui.slides.length;
			if (length < 2) return;
			const isReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
			const duration = isReduced ? 0 : ANIMATION_DURATION;
			let animating = false;

			// Marks one slide (and its thumbnail) as showing
			const setCurrent = (index: number, isCurrent: boolean) => {
				const slide = ui.slides[index];
				const thumb = ui.thumbs[index];
				if (slide) {
					slide.dataset.state = isCurrent ? 'current' : '';
					slide.setAttribute('aria-hidden', String(!isCurrent));
				}
				if (thumb) {
					thumb.dataset.state = isCurrent ? 'current' : '';
					if (isCurrent) thumb.setAttribute('aria-current', 'true');
					else thumb.removeAttribute('aria-current');
				}
			};
			ui.slides.forEach((_, index) => {
				setCurrent(index, index === currentRef.current);
			});

			const navigate = (direction: 1 | -1, targetIndex: number | null = null) => {
				if (animating) return;
				animating = true;
				observer.disable();

				const previous = currentRef.current;
				const current =
					targetIndex !== null
						? targetIndex
						: direction === 1
							? previous < length - 1
								? previous + 1
								: 0
							: previous > 0
								? previous - 1
								: length - 1;
				currentRef.current = current;

				gsap.timeline({
					defaults: { duration, ease: 'slideshow-wipe' },
					onStart: () => {
						setCurrent(current, true);
						ui.thumbs[previous]?.removeAttribute('data-state');
						ui.thumbs[previous]?.removeAttribute('aria-current');
					},
					onComplete: () => {
						setCurrent(previous, false);
						animating = false;
						observer.enable();
					},
				})
					.to(ui.slides[previous] as HTMLElement, { xPercent: -direction * 100 }, 0)
					.to(ui.inner[previous] as HTMLElement, { xPercent: direction * PARALLAX }, 0)
					.fromTo(ui.slides[current] as HTMLElement, { xPercent: direction * 100 }, { xPercent: 0 }, 0)
					.fromTo(ui.inner[current] as HTMLElement, { xPercent: -direction * PARALLAX }, { xPercent: 0 }, 0);
			};

			// Autoplay (phones only): stops for good once the visitor swipes, and waits while off screen
			let autoplay: gsap.core.Tween | null = null;
			const scheduleAutoplay = () => {
				autoplay = gsap.delayedCall(AUTOPLAY_SECONDS, () => {
					navigate(1);
					scheduleAutoplay();
				});
			};
			const stopAutoplay = () => {
				hasSwipedRef.current = true;
				autoplay?.kill();
				autoplay = null;
			};
			const visibility = new IntersectionObserver(([entry]) => {
				autoplay?.paused(!entry?.isIntersecting);
			});
			if (isMobile && !isReduced && !hasSwipedRef.current) {
				scheduleAutoplay();
				visibility.observe(el);
			}

			// Swipe or drag left/right, or scroll sideways; a swipe also ends the autoplay
			const swipe = (direction: 1 | -1) => {
				if (animating) return;
				stopAutoplay();
				navigate(direction);
			};
			const observer = Observer.create({
				target: el,
				type: 'wheel,touch,pointer',
				onLeft: () => swipe(1),
				onRight: () => swipe(-1),
				onWheel: event => {
					if (animating) return;
					if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
						if (event.deltaX > WHEEL_THRESHOLD) swipe(1);
						else if (event.deltaX < -WHEEL_THRESHOLD) swipe(-1);
					}
				},
				wheelSpeed: -1,
				tolerance: 10,
			});

			// Thumbnails jump straight to their slide
			const onClick = (event: Event) => {
				const targetIndex = ui.thumbs.indexOf(event.currentTarget as HTMLElement);
				if (targetIndex === currentRef.current || animating) return;
				navigate(targetIndex > currentRef.current ? 1 : -1, targetIndex);
			};
			for (const thumb of ui.thumbs) thumb.addEventListener('click', onClick);

			// NOTE • Tweens and the Observer go with the GSAP context; the listeners and IntersectionObserver don't
			return () => {
				visibility.disconnect();
				for (const thumb of ui.thumbs) thumb.removeEventListener('click', onClick);
			};
		},
		{ scope: wrapRef, dependencies: [images] }
	);

	// Render
	return (
		<div ref={wrapRef} data-slideshow='wrap' className={s.jacket}>
			<div className={s.list}>
				{images.map((image, index) => (
					<div
						key={image.src}
						data-slideshow='slide'
						data-state={index === 0 ? 'current' : undefined}
						aria-hidden={index !== 0}
						className={s.slide}
					>
						<Image
							data-slideshow='parallax'
							src={image.src}
							alt={image.alt}
							fill
							sizes={sizes}
							quality={90}
							draggable={false}
							className={s.inner}
							style={focusStyle(image)}
						/>
					</div>
				))}
			</div>
			<div className={s.nav}>
				{images.map((image, index) => (
					<button
						key={image.src}
						type='button'
						data-slideshow='thumb'
						data-state={index === 0 ? 'current' : undefined}
						aria-current={index === 0 || undefined}
						aria-label={`Show image ${index + 1} of ${images.length}`}
						className={s.thumb}
					>
						<Image src={image.src} alt='' fill sizes='112px' quality={60} draggable={false} />
					</button>
				))}
			</div>
		</div>
	);
};

// Exports
// ------------
ParallaxGallery.displayName = 'ParallaxGallery';
export default ParallaxGallery;
