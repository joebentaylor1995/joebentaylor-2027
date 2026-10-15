'use client';

// Imports
// ------------
import { GlobalContext } from '@parts/Contexts';
import { PerformanceContext } from '@parts/Contexts/Performance';
import { gsap } from 'gsap';
import Lenis from 'lenis';
import { use, useEffect, useRef, useState } from 'react';

// Styles + Interfaces
// ------------
import type * as I from './interface';
import s from './styles.module.scss';

// Cursor motion
// ------------
const CURSOR_SPEED = 0.25;
const CURSOR_SNAP_DURATION = 0.4;
const CURSOR_STRETCH_DISTANCE = 400;
const CURSOR_MAX_STRETCH = 0.25;

// Component
// ------------
const ProfileReveal = ({ children, profile }: I.ProfileRevealProps) => {
	// Context
	const { profileOpen, setProfileOpen, lenisRef } = use(GlobalContext);
	const { isReducedMotion } = use(PerformanceContext);

	// Refs
	const sceneRef = useRef<HTMLDivElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const panelContentRef = useRef<HTMLDivElement>(null);
	const closeRef = useRef<HTMLButtonElement>(null);
	const jacketRef = useRef<HTMLDivElement>(null);
	const cursorRef = useRef<HTMLDivElement>(null);
	const closeCursorRef = useRef<HTMLDivElement>(null);

	// State
	const [presented, setPresented] = useState(false);
	const active = profileOpen || presented;

	// Effects
	useEffect(() => {
		const cursor = cursorRef.current;
		const jacket = jacketRef.current;
		const close = closeRef.current;
		if (!profileOpen || !cursor || !jacket || !close) return;
		const mouse = window.matchMedia('(hover: hover) and (pointer: fine)');
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
		const position = { x: 0, y: 0 };
		let movement: gsap.core.Tween | null = null;
		let visible = false;
		let targetX = 0;
		let targetY = 0;
		const resetShape = () => {
			cursor.style.removeProperty('--cursor-angle');
			cursor.style.removeProperty('--cursor-stretch');
			cursor.style.removeProperty('--cursor-squash');
		};
		// The follower's lag provides direction and strength, and naturally decays at rest.
		const deform = () => {
			gsap.set(cursor, { x: position.x, y: position.y });
			if (!visible || reduced.matches || jacket.dataset.cursor !== 'follow') {
				resetShape();
				return;
			}
			const dx = targetX - position.x;
			const dy = targetY - position.y;
			const stretch = Math.min(Math.hypot(dx, dy) / CURSOR_STRETCH_DISTANCE, CURSOR_MAX_STRETCH);
			cursor.style.setProperty('--cursor-angle', `${Math.atan2(dy, dx)}rad`);
			cursor.style.setProperty('--cursor-stretch', String(1 + stretch));
			cursor.style.setProperty('--cursor-squash', String(1 - stretch));
		};
		const hide = () => {
			movement?.kill();
			visible = false;
			delete jacket.dataset.cursor;
			resetShape();
		};
		const move = (event: PointerEvent) => {
			if (
				!mouse.matches ||
				event.pointerType !== 'mouse' ||
				!(event.target instanceof Node) ||
				!jacket.contains(event.target)
			) {
				hide();
				return;
			}
			const overClose = close.contains(event.target);
			// Independent positioning keeps the glyph off the circle's eased animation path.
			gsap.set(closeCursorRef.current, { x: event.clientX, y: event.clientY });
			const wasSticky = jacket.dataset.cursor === 'sticky';
			const inside = panelRef.current?.contains(event.target);
			let x = event.clientX;
			let y = event.clientY;
			if (overClose) {
				const bounds = close.getBoundingClientRect();
				x = bounds.left + bounds.width / 2;
				y = bounds.top + bounds.height / 2;
			}
			jacket.dataset.cursor = overClose ? 'sticky' : inside ? 'follow' : 'close';
			targetX = x;
			targetY = y;
			movement?.kill();
			if (!visible || reduced.matches) {
				position.x = x;
				position.y = y;
				deform();
			} else {
				movement = gsap.to(position, {
					x,
					y,
					duration: overClose || wasSticky ? CURSOR_SNAP_DURATION : CURSOR_SPEED,
					ease: overClose || wasSticky ? 'power2.out' : 'power3.out',
					onUpdate: deform,
				});
			}
			visible = true;
			deform();
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('blur', hide);
		document.addEventListener('pointerleave', hide);
		mouse.addEventListener('change', hide);
		return () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('blur', hide);
			document.removeEventListener('pointerleave', hide);
			mouse.removeEventListener('change', hide);
			hide();
		};
	}, [profileOpen]);

	useEffect(() => {
		if (profileOpen) {
			setPresented(true);
			panelRef.current?.scrollTo(0, 0);
			return;
		}
		let cancelled = false;
		// Keep scrolling locked and focus contained until the return journey finishes.
		const frame = requestAnimationFrame(() => {
			const animations = [
				...(sceneRef.current?.getAnimations() ?? []),
				...(panelRef.current?.getAnimations() ?? []),
			];
			void Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
				if (!cancelled) setPresented(false);
			});
		});
		return () => {
			cancelled = true;
			cancelAnimationFrame(frame);
		};
	}, [profileOpen]);

	useEffect(() => {
		const wrapper = panelRef.current;
		const content = panelContentRef.current;
		if (!profileOpen || isReducedMotion || !wrapper || !content) return;

		const modalLenis = new Lenis({ wrapper, content, autoRaf: false, syncTouch: false });
		const update = (time: number) => modalLenis.raf(time * 1000);
		gsap.ticker.add(update);

		return () => {
			gsap.ticker.remove(update);
			modalLenis.destroy();
		};
	}, [profileOpen, isReducedMotion]);

	useEffect(() => {
		if (!active) return;
		const scene = sceneRef.current;
		const animations =
			scene
				?.getAnimations({ subtree: true })
				.filter(
					animation =>
						animation.effect instanceof KeyframeEffect &&
						animation.effect.target !== scene &&
						animation.playState === 'running'
				) ?? [];
		const timelines = new Set<gsap.core.Animation>();
		for (const tween of gsap.getTweensOf(scene?.querySelectorAll('*') ?? [])) {
			let animation: gsap.core.Animation = tween;
			while (animation.parent && animation.parent !== gsap.globalTimeline) animation = animation.parent;
			if (!animation.paused()) timelines.add(animation);
		}
		for (const animation of animations) animation.pause();
		for (const animation of timelines) animation.pause();
		return () => {
			for (const animation of animations) animation.play();
			for (const animation of timelines) animation.resume();
		};
	}, [active]);

	useEffect(() => {
		if (!active) return;
		const previousFocus = document.activeElement;
		const page = document.getElementById('page');
		const overflow = page?.style.overflow;
		const lenis = lenisRef.current?.lenis;
		const wasStopped = lenis?.isStopped;
		lenis?.stop();
		if (page) page.style.overflow = 'hidden';
		closeRef.current?.focus({ preventScroll: true });
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				setProfileOpen(false);
			}
			if (event.key !== 'Tab') return;
			const focusable = Array.from(
				panelRef.current?.querySelectorAll<HTMLElement>(
					'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
				) ?? []
			).filter(element => element.getClientRects().length > 0);
			const first = focusable[0];
			const last = focusable.at(-1);
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last?.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first?.focus();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			if (page) page.style.overflow = overflow ?? '';
			if (lenis && !wasStopped) lenis.start();
			if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
		};
	}, [active, lenisRef, setProfileOpen]);

	// Render
	return (
		<div ref={jacketRef} className={s.jacket} data-state={profileOpen ? 'open' : active ? 'closing' : 'closed'}>
			<div
				ref={panelRef}
				id='profile-panel'
				className={s.panel}
				role='dialog'
				aria-modal={active ? true : undefined}
				aria-label='Profile'
				aria-hidden={!active}
				inert={!active}
			>
				<div ref={panelContentRef} className={s.panelContent}>
					<div className={s.toolbar}>
						<button
							ref={closeRef}
							type='button'
							className={s.closeButton}
							aria-label='Close profile'
							onClick={() => setProfileOpen(false)}
						>
							<svg width='16' height='16' viewBox='0 0 16 16' fill='none' aria-hidden='true'>
								<path
									className={s.mobileIcon}
									d='m3 3 10 10M13 3 3 13'
									stroke='currentColor'
									strokeLinecap='round'
								/>
								<path
									className={s.desktopIcon}
									d='M13 8H3m4-4L3 8l4 4'
									stroke='currentColor'
									strokeLinecap='round'
									strokeLinejoin='round'
								/>
							</svg>
						</button>
					</div>
					{profile ?? <div className={s.placeholder} aria-hidden='true' />}
				</div>
			</div>
			<div
				ref={sceneRef}
				className={s.scene}
				inert={active}
				data-profile-scene
				data-scene-paused={active ? 'true' : undefined}
			>
				{children}
			</div>
			<button
				type='button'
				className={s.overlay}
				aria-label='Close profile backdrop'
				aria-hidden='true'
				tabIndex={-1}
				disabled={!profileOpen}
				onClick={() => setProfileOpen(false)}
			/>
			<div ref={cursorRef} className={s.cursor} aria-hidden='true'>
				<span className={s.cursorAppearance}>
					<span className={s.cursorShape} />
				</span>
			</div>
			<div ref={closeCursorRef} className={s.closeCursor} aria-hidden='true' data-close-cursor>
				<svg width='20' height='20' viewBox='0 0 20 20' fill='none' aria-hidden='true'>
					<path d='m4 4 12 12M16 4 4 16' stroke='currentColor' strokeWidth='1.5' />
				</svg>
			</div>
		</div>
	);
};

// Exports
// ------------
ProfileReveal.displayName = 'ProfileReveal';
export default ProfileReveal;
