'use client';

// Imports
// ------------
import { useAnimation } from '@utils/useAnimation';
import gsap from 'gsap';
import { Draggable } from 'gsap/Draggable';
import Image from 'next/image';
import { type CSSProperties, useRef } from 'react';

// Styles + Interfaces
// ------------
import type { GalleryImage } from '@/data/projects';
import type * as I from './interface';
import s from './styles.module.scss';

// Constants
// ------------
// NOTE • Osmo "Before/After Split Slider": dragging the handle resizes a clip-path
// mask on the "after" layer. Arrow keys nudge it too, so it works without a pointer.
gsap.registerPlugin(Draggable);
const KEY_STEP = 5;
const KEY_STEP_LARGE = 20;

const focusStyle = (image: GalleryImage) =>
	image.hotspot ? ({ '--focus': `${image.hotspot.x * 100}% ${image.hotspot.y * 100}%` } as CSSProperties) : undefined;

// Component
// ------------
const BeforeAfter = ({ before, after, start, sizes }: I.BeforeAfterProps) => {
	// Refs
	const wrapRef = useRef<HTMLDivElement>(null);

	// Animations
	useAnimation(
		() => {
			const splitter = wrapRef.current;
			const handle = splitter?.querySelector<HTMLElement>('[data-splitter="handle"]');
			const afterLayer = splitter?.querySelector<HTMLElement>('[data-splitter="after"]');
			if (!splitter || !handle || !afterLayer) return;

			let bounds = splitter.getBoundingClientRect();
			let currentPercent = parseFloat(splitter.getAttribute('data-splitter-initial') ?? '') || 50;

			const setClip = (percent: number) => {
				gsap.set(afterLayer, { clipPath: `inset(0 0 0 ${percent}%)` });
				// NOTE • A drag moves many times per whole percent; the slider's value only changes
				// (and only needs announcing) when the rounded number does
				const value = String(Math.round(percent));
				if (handle.getAttribute('aria-valuenow') === value) return;
				handle.setAttribute('aria-valuenow', value);
				handle.setAttribute('aria-valuetext', `${value}% before`);
			};
			const setPositions = (percent: number) => {
				bounds = splitter.getBoundingClientRect();
				const positionX = (percent / 100) * bounds.width;
				gsap.set(handle, { x: positionX, left: 'unset' });
				setClip(percent);
			};

			setPositions(currentPercent);

			const [draggable] = Draggable.create(handle, {
				type: 'x',
				bounds: splitter,
				cursor: 'ew-resize',
				activeCursor: 'grabbing',
				onDrag() {
					currentPercent = (this.x / bounds.width) * 100;
					setClip(currentPercent);
				},
			});

			// Keyboard: arrows nudge (Shift for a bigger step), Home/End jump to the edges
			const onKeyDown = (event: KeyboardEvent) => {
				const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
				const next =
					event.key === 'ArrowLeft' || event.key === 'ArrowDown'
						? currentPercent - step
						: event.key === 'ArrowRight' || event.key === 'ArrowUp'
							? currentPercent + step
							: event.key === 'Home'
								? 0
								: event.key === 'End'
									? 100
									: null;
				if (next === null) return;
				event.preventDefault();
				currentPercent = Math.min(100, Math.max(0, next));
				setPositions(currentPercent);
				draggable?.update();
			};
			handle.addEventListener('keydown', onKeyDown);

			// NOTE • The tile can resize without the window (layout switches), so watch the splitter itself
			const resize = new ResizeObserver(() => {
				setPositions(currentPercent);
				draggable?.update();
			});
			resize.observe(splitter);

			// NOTE • Draggable, the listener and the ResizeObserver aren't reverted by the GSAP context
			return () => {
				draggable?.kill();
				handle.removeEventListener('keydown', onKeyDown);
				resize.disconnect();
			};
		},
		{ scope: wrapRef, dependencies: [start] }
	);

	// Render
	return (
		<div ref={wrapRef} data-splitter='wrap' data-splitter-initial={start} className={s.jacket}>
			<div className={s.content}>
				<Image
					src={before.src}
					alt={before.alt}
					fill
					sizes={sizes}
					quality={90}
					draggable={false}
					style={focusStyle(before)}
				/>
			</div>
			<div data-splitter='after' className={s.content} style={{ clipPath: `inset(0 0 0 ${start}%)` }}>
				<Image
					src={after.src}
					alt={after.alt}
					fill
					sizes={sizes}
					quality={90}
					draggable={false}
					style={focusStyle(after)}
				/>
			</div>
			<div
				data-splitter='handle'
				className={s.handle}
				style={{ left: `${start}%` }}
				role='slider'
				tabIndex={0}
				aria-label='Compare before and after'
				aria-orientation='horizontal'
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round(start)}
				aria-valuetext={`${Math.round(start)}% before`}
			>
				<div className={s.center}>
					<svg
						xmlns='http://www.w3.org/2000/svg'
						width='100%'
						viewBox='0 0 24 24'
						fill='none'
						className={s.icon}
						aria-hidden='true'
					>
						<path
							d='M20.7931 11.5L15.2931 5.99995L16.0002 5.29285L22.3537 11.6464V12.3535L16.0002 18.7071L15.2931 18L20.793 12.5L3.20719 12.5L8.70714 18L8.00004 18.7071L1.64648 12.3535L1.64648 11.6464L8.00004 5.29285L8.70714 5.99995L3.2071 11.5L20.7931 11.5Z'
							fill='currentColor'
						/>
					</svg>
				</div>
			</div>
		</div>
	);
};

// Exports
// ------------
BeforeAfter.displayName = 'BeforeAfter';
export default BeforeAfter;
