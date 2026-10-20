'use client';

// Imports
// ------------
import { GlobalContext } from '@parts/Contexts';
import { PerformanceContext } from '@parts/Contexts/Performance';
import { DESKTOP_HOVER_QUERY } from '@utils/desktopHover';
import { preloadNearbyMedia } from '@utils/preloadNearbyMedia';
import { gsap } from 'gsap';
import Lenis from 'lenis';
import Image from 'next/image';
import { type ComponentType, use, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ProfilePresenceContext } from './context';

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
	const [Settings, setSettings] = useState<ComponentType | null>(null);
	const active = profileOpen || presented;

	// Effects
	useEffect(() => {
		if (profileOpen && panelRef.current) return preloadNearbyMedia(panelRef.current);
	}, [profileOpen]);

	useEffect(() => {
		if (!new URLSearchParams(window.location.search).has('modalSettings')) return;
		let disposed = false;
		void import('./Settings').then(module => {
			if (!disposed) setSettings(() => module.default);
		});
		return () => {
			disposed = true;
		};
	}, []);

	useEffect(() => {
		const cursor = cursorRef.current;
		const jacket = jacketRef.current;
		if (!cursor || !jacket) return;
		let lastPointer: PointerEvent | null = null;
		const mouse = window.matchMedia(DESKTOP_HOVER_QUERY);
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
			lastPointer = event;
			const target = document.elementFromPoint(event.clientX, event.clientY);
			const projectPanel = target?.closest('[data-project-panel][data-open="true"]');
			if ((!profileOpen && !projectPanel) || target?.closest('[data-modal-settings], dialog[open]')) {
				hide();
				return;
			}
			if (!mouse.matches || event.pointerType !== 'mouse' || !target || !jacket.contains(target)) {
				hide();
				return;
			}
			const stickyTarget = target.closest<HTMLElement>('[data-cursor-sticky]');
			// Independent positioning keeps the glyph off the circle's eased animation path.
			gsap.set(closeCursorRef.current, { x: event.clientX, y: event.clientY });
			const wasSticky = jacket.dataset.cursor === 'sticky';
			const inside = projectPanel || panelRef.current?.contains(target);
			let x = event.clientX;
			let y = event.clientY;
			if (stickyTarget) {
				const bounds = (
					stickyTarget.querySelector('[data-cursor-anchor]') ?? stickyTarget
				).getBoundingClientRect();
				x = bounds.left + bounds.width / 2;
				y = bounds.top + bounds.height / 2;
				if (stickyTarget.hasAttribute('data-cursor-fit')) {
					cursor.style.setProperty('--cursor-fit-width', `${bounds.width}px`);
					cursor.style.setProperty('--cursor-fit-height', `${bounds.height}px`);
					cursor.style.setProperty('--cursor-fit-radius', getComputedStyle(stickyTarget).borderRadius);
				}
			}
			if (!stickyTarget?.hasAttribute('data-cursor-fit')) {
				cursor.style.removeProperty('--cursor-fit-width');
				cursor.style.removeProperty('--cursor-fit-height');
				cursor.style.removeProperty('--cursor-fit-radius');
			}
			const overLink = target.closest('[data-cursor-link]');
			const overSoft = target.closest('[data-cursor-soft]');
			const overCta = target.closest('[data-cursor-cta]');
			if (overCta && !reduced.matches) {
				const bounds = overCta.getBoundingClientRect();
				x += Math.max(-18, Math.min(18, (bounds.left + bounds.width / 2 - x) * 0.12));
				y += Math.max(-18, Math.min(18, (bounds.top + bounds.height / 2 - y) * 0.12));
			}
			jacket.dataset.cursor = stickyTarget
				? 'sticky'
				: overCta
					? 'cta'
					: overSoft
						? 'soft'
						: overLink
							? 'link'
							: inside
								? 'follow'
								: 'close';
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
					duration: stickyTarget || wasSticky ? CURSOR_SNAP_DURATION : CURSOR_SPEED,
					ease: stickyTarget || wasSticky ? 'power2.out' : 'power3.out',
					onUpdate: deform,
				});
			}
			visible = true;
			deform();
		};
		window.addEventListener('pointermove', move);
		const refresh = () => {
			if (lastPointer) move(lastPointer);
		};
		window.addEventListener('project-panel:change', refresh);
		window.addEventListener('scroll', refresh, true);
		window.addEventListener('blur', hide);
		document.addEventListener('pointerleave', hide);
		mouse.addEventListener('change', hide);
		return () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('project-panel:change', refresh);
			window.removeEventListener('scroll', refresh, true);
			window.removeEventListener('blur', hide);
			document.removeEventListener('pointerleave', hide);
			mouse.removeEventListener('change', hide);
			hide();
		};
	}, [profileOpen]);

	useEffect(() => {
		if (profileOpen) {
			setPresented(true);
			return;
		}
		let cancelled = false;
		// Keep scrolling locked and focus contained until the return journey finishes.
		const frame = requestAnimationFrame(() => {
			const animations = [
				...(sceneRef.current?.getAnimations() ?? []),
				...(panelRef.current?.getAnimations() ?? []),
				...(panelContentRef.current?.getAnimations() ?? []),
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

	useLayoutEffect(() => {
		const wrapper = panelRef.current;
		const content = panelContentRef.current;
		if (!profileOpen || !wrapper || !content) return;

		// Reset before the opening frame, including native/reduced-motion scrolling.
		wrapper.scrollTo({ top: 0, left: 0, behavior: 'instant' });
		if (isReducedMotion) return;

		const modalLenis = new Lenis({ wrapper, content, autoRaf: false, syncTouch: false });
		modalLenis.scrollTo(0, { immediate: true, force: true });
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
		if (!scene) return;
		const animations = new Set<Animation>();
		const timelines = new Set<gsap.core.Animation>();
		const pause = () => {
			for (const animation of scene.getAnimations({ subtree: true })) {
				if (
					animation.effect instanceof KeyframeEffect &&
					animation.effect.target !== scene &&
					animation.playState === 'running'
				) {
					animations.add(animation);
					animation.pause();
				}
			}
			for (const tween of gsap.getTweensOf(scene.querySelectorAll('*'))) {
				let animation: gsap.core.Animation = tween;
				while (animation.parent && animation.parent !== gsap.globalTimeline) animation = animation.parent;
				if (!animation.paused()) {
					timelines.add(animation);
					animation.pause();
				}
			}
		};
		pause();
		// Lazy content may start a reveal after the modal has already opened.
		const additions = new MutationObserver(pause);
		additions.observe(scene, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
		return () => {
			additions.disconnect();
			for (const animation of animations) animation.play();
			for (const animation of timelines) if (animation.parent) animation.resume();
		};
	}, [active]);

	useEffect(() => {
		if (!active) return;
		const previousFocus = document.activeElement;
		const page = document.getElementById('page');
		const overflow = page?.style.overflow;
		const lenis = lenisRef.current?.lenis;
		const wasStopped = lenis?.isStopped;
		const scrollRoot = lenis?.rootElement;
		const scrollOverflow = scrollRoot?.style.overflow ?? '';
		// Lenis' stopped class uses overflow: clip, which resets the pinned page's scroll.
		// Preserve its scroll container while the profile has its own scrolling instance.
		if (scrollRoot) scrollRoot.style.overflow = 'hidden';
		lenis?.stop();
		if (page) page.style.overflow = 'hidden';
		closeRef.current?.focus({ preventScroll: true });
		const onKeyDown = (event: KeyboardEvent) => {
			if (document.querySelector('dialog[open]')) return;
			if (event.key === 'Escape') {
				event.preventDefault();
				setProfileOpen(false);
			}
			if (event.key !== 'Tab') return;
			const focusable = Array.from(
				jacketRef.current?.querySelectorAll<HTMLElement>(
					'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
				) ?? []
			).filter(
				element =>
					element.getClientRects().length > 0 && element.closest('#profile-panel, [data-modal-settings]')
			);
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
			if (scrollRoot) scrollRoot.style.overflow = scrollOverflow;
			if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
		};
	}, [active, lenisRef, setProfileOpen]);

	// Render
	return (
		<div ref={jacketRef} className={s.jacket} data-state={profileOpen ? 'open' : active ? 'closing' : 'closed'}>
			{Settings && <Settings />}
			<div
				ref={panelRef}
				id='profile-panel'
				className={s.panel}
				role='dialog'
				aria-modal={active && !Settings ? true : undefined}
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
							data-cursor-sticky
							onClick={() => setProfileOpen(false)}
						>
							<Image src='/images/reviews/arrow.svg' width={16} height={11} alt='' />
						</button>
					</div>
					<ProfilePresenceContext.Provider value={active}>
						{profile ?? <div className={s.placeholder} aria-hidden='true' />}
					</ProfilePresenceContext.Provider>
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
					<svg
						className={s.ctaCursor}
						width='20'
						height='20'
						viewBox='0 0 20 20'
						fill='none'
						aria-hidden='true'
					>
						<path d='M5 15 15 5M5 5h10v10' stroke='currentColor' strokeWidth='1.5' />
					</svg>
					<svg
						className={s.linkCursor}
						width='16'
						height='16'
						viewBox='0 0 16 16'
						fill='currentColor'
						aria-hidden='true'
					>
						<path d='M11,0C9.7,0,8.4,0.5,7.5,1.5L6.3,2.6C5.9,3,5.9,3.6,6.3,4s1,0.4,1.4,0l1.2-1.2c1.1-1.1,3.1-1.1,4.2,0 C13.7,3.4,14,4.2,14,5s-0.3,1.6-0.9,2.1L12,8.3c-0.4,0.4-0.4,1,0,1.4c0.2,0.2,0.5,0.3,0.7,0.3s0.5-0.1,0.7-0.3l1.2-1.2 C15.5,7.6,16,6.3,16,5s-0.5-2.6-1.5-3.5C13.6,0.5,12.3,0,11,0z' />
						<path d='M8.3,12l-1.2,1.2c-1.1,1.1-3.1,1.1-4.2,0C2.3,12.6,2,11.8,2,11s0.3-1.6,0.9-2.1L4,7.7c0.4-0.4,0.4-1,0-1.4 s-1-0.4-1.4,0L1.5,7.5C0.5,8.4,0,9.7,0,11s0.5,2.6,1.5,3.5C2.4,15.5,3.7,16,5,16s2.6-0.5,3.5-1.5l1.2-1.2c0.4-0.4,0.4-1,0-1.4 S8.7,11.6,8.3,12z' />
						<path d='M9.4,5.2L5.2,9.4c-0.4,0.4-0.4,1,0,1.4c0.2,0.2,0.5,0.3,0.7,0.3s0.5-0.1,0.7-0.3l4.2-4.2 c0.4-0.4,0.4-1,0-1.4C10.4,4.8,9.8,4.8,9.4,5.2z' />
					</svg>
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
