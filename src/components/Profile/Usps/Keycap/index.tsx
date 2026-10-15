'use client';

// Imports
// ------------
import { ProfilePresenceContext } from '@parts/ProfileReveal/context';
import { getSettings, subscribe } from '@parts/ProfileReveal/Settings/store';
import { gsap } from 'gsap';
import NextImage from 'next/image';
import { use, useEffect, useRef } from 'react';

// Styles
// ------------
import s from './styles.module.scss';

const LAST_FRAME = 32;
const HOVER_FRAME = 4;
const frameUrl = (frame: number) => `/images/keycap/frames/${String(frame + 1).padStart(4, '0')}.webp`;

// Component
// ------------
const Keycap = () => {
	// Context
	const profilePresent = use(ProfilePresenceContext);

	// Refs
	const buttonRef = useRef<HTMLButtonElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	// Effects
	useEffect(() => {
		const apply = () => {
			const button = buttonRef.current;
			if (!button) return;
			const settings = getSettings();
			button.style.setProperty('--keycap-x', `${settings.keycapX}%`);
			button.style.setProperty('--keycap-y', `${settings.keycapY}%`);
			button.style.setProperty('--keycap-size', `${settings.keycapSize}%`);
			button.style.setProperty('--keycap-rotation', `${settings.keycapRotation}deg`);
			if (!settings.keycapTilt) {
				button.style.setProperty('--keycap-tilt-x', '0deg');
				button.style.setProperty('--keycap-tilt-y', '0deg');
			}
		};
		apply();
		return subscribe(apply);
	}, []);

	useEffect(() => {
		const button = buttonRef.current;
		const canvas = canvasRef.current;
		const context = canvas?.getContext('2d');
		if (!profilePresent || !button || !canvas || !context) return;
		let disposed = false;
		let ready = false;
		let held = false;
		let hovered = false;
		let pointerId: number | null = null;
		let tween: gsap.core.Tween | undefined;
		const pose = { frame: 0 };
		const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
		const frames: HTMLImageElement[] = [];
		const sounds = ['down', 'up'].map(direction => {
			const audio = new Audio(`/audio/keycap/${direction}.mp3`);
			audio.volume = 0.45;
			audio.preload = 'auto';
			return audio;
		});
		const draw = () => {
			const frame = Math.max(0, Math.min(LAST_FRAME, Math.round(pose.frame)));
			context.drawImage(frames[frame], 0, 0, canvas.width, canvas.height);
			button.dataset.frame = String(frame);
		};
		const animate = (frame: number) => {
			if (!ready) return;
			tween?.kill();
			tween = gsap.to(pose, {
				frame,
				duration: reducedMotion.matches ? 0 : held ? 0.085 : 0.18,
				ease: 'power2.out',
				onUpdate: draw,
			});
		};
		const play = (index: number) => {
			if (!getSettings().keycapSound) return;
			for (const sound of sounds) sound.pause();
			sounds[index].currentTime = 0;
			void sounds[index].play().catch(() => {});
		};
		const press = () => {
			if (!ready || held) return;
			held = true;
			button.dataset.pressed = 'true';
			animate(LAST_FRAME);
			play(0);
		};
		const release = (audible = true) => {
			if (!held) return;
			held = false;
			button.dataset.pressed = 'false';
			animate(hovered && !reducedMotion.matches ? HOVER_FRAME : 0);
			if (audible) play(1);
		};
		const enter = (event: PointerEvent) => {
			hovered = event.pointerType !== 'touch';
			if (!held && !reducedMotion.matches && hovered) animate(HOVER_FRAME);
		};
		const leave = () => {
			hovered = false;
			button.style.setProperty('--keycap-tilt-x', '0deg');
			button.style.setProperty('--keycap-tilt-y', '0deg');
			if (!held) animate(0);
		};
		const move = (event: PointerEvent) => {
			if (!getSettings().keycapTilt || reducedMotion.matches || event.pointerType === 'touch') return;
			const bounds = button.getBoundingClientRect();
			button.style.setProperty('--keycap-tilt-x', `${(0.5 - (event.clientY - bounds.y) / bounds.height) * 8}deg`);
			button.style.setProperty('--keycap-tilt-y', `${((event.clientX - bounds.x) / bounds.width - 0.5) * 8}deg`);
		};
		const down = (event: PointerEvent) => {
			if (event.button !== 0 || pointerId !== null || !ready) return;
			pointerId = event.pointerId;
			button.setPointerCapture(event.pointerId);
			press();
		};
		const up = (event: PointerEvent) => {
			if (event.pointerId !== pointerId) return;
			pointerId = null;
			release(event.type === 'pointerup');
		};
		const keyDown = (event: KeyboardEvent) => {
			if (event.code !== 'Space' && event.code !== 'Enter') return;
			event.preventDefault();
			if (!event.repeat) press();
		};
		const keyUp = (event: KeyboardEvent) => {
			if (event.code !== 'Space' && event.code !== 'Enter') return;
			event.preventDefault();
			release();
		};
		const reset = () => {
			pointerId = null;
			leave();
			release(false);
			for (const sound of sounds) sound.pause();
		};
		const visibility = () => {
			if (document.hidden) reset();
		};
		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return;
				observer.disconnect();
				void Promise.all(
					Array.from({ length: LAST_FRAME + 1 }, (_, frame) => {
						const image = new Image();
						image.src = frameUrl(frame);
						frames[frame] = image;
						return image.decode();
					})
				)
					.then(() => {
						if (disposed) return;
						ready = true;
						draw();
						button.dataset.state = 'ready';
					})
					.catch(() => {
						if (!disposed) button.dataset.state = 'error';
					});
			},
			{ rootMargin: '150px' }
		);
		observer.observe(button);
		button.addEventListener('pointerenter', enter);
		button.addEventListener('pointerleave', leave);
		button.addEventListener('pointermove', move);
		button.addEventListener('pointerdown', down);
		button.addEventListener('pointerup', up);
		button.addEventListener('pointercancel', up);
		button.addEventListener('lostpointercapture', up);
		button.addEventListener('keydown', keyDown);
		button.addEventListener('keyup', keyUp);
		button.addEventListener('blur', reset);
		window.addEventListener('blur', reset);
		document.addEventListener('visibilitychange', visibility);
		return () => {
			disposed = true;
			observer.disconnect();
			tween?.kill();
			for (const sound of sounds) {
				sound.pause();
				sound.removeAttribute('src');
				sound.load();
			}
			button.removeEventListener('pointerenter', enter);
			button.removeEventListener('pointerleave', leave);
			button.removeEventListener('pointermove', move);
			button.removeEventListener('pointerdown', down);
			button.removeEventListener('pointerup', up);
			button.removeEventListener('pointercancel', up);
			button.removeEventListener('lostpointercapture', up);
			button.removeEventListener('keydown', keyDown);
			button.removeEventListener('keyup', keyUp);
			button.removeEventListener('blur', reset);
			window.removeEventListener('blur', reset);
			document.removeEventListener('visibilitychange', visibility);
			button.dataset.state = 'loading';
			button.dataset.pressed = 'false';
			button.style.removeProperty('--keycap-tilt-x');
			button.style.removeProperty('--keycap-tilt-y');
		};
	}, [profilePresent]);

	// Render
	return (
		<button
			ref={buttonRef}
			type='button'
			className={s.jacket}
			aria-label='Press mechanical keycap'
			data-keycap
			data-state='loading'
			data-pressed='false'
			disabled={!profilePresent}
		>
			<div className={s.artwork}>
				<NextImage src={frameUrl(0)} alt='' width={1200} height={1200} unoptimized draggable={false} />
				<canvas ref={canvasRef} width={1200} height={1200} aria-hidden='true' tabIndex={-1} />
			</div>
		</button>
	);
};

// Exports
// ------------
Keycap.displayName = 'Keycap';
export default Keycap;
