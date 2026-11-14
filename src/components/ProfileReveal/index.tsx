'use client';

// Imports
// ------------
import { GlobalContext } from '@parts/Contexts';
import { PerformanceContext } from '@parts/Contexts/Performance';
import { DESKTOP_HOVER_QUERY, touchOnlyEventsTarget } from '@utils/desktopHover';
import { smoothFrameTime } from '@utils/frameClock';
import { preloadNearbyMedia } from '@utils/preloadNearbyMedia';
import { gsap } from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import Image from 'next/image';
import { type ComponentType, use, useDeferredValue, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ProfilePresenceContext } from './context';

// Styles + Interfaces
// ------------
import type * as I from './interface';
import s from './styles.module.scss';

// Constants
// ------------
// Cursor follower: seconds to catch the pointer, and seconds to snap onto a sticky
// target. Stretch grows with its lag (px) up to a maximum.
const CURSOR_SPEED = 0.25;
const CURSOR_SNAP_DURATION = 0.4;
const CURSOR_STRETCH_DISTANCE = 400;
// Applied as scale 1 + x along the motion and 1 - x across it
const CURSOR_MAX_STRETCH = 0.25;
// CTAs pull the cursor toward their centre by this share of the gap, up to a px limit
const CTA_NUDGE_STRENGTH = 0.12;
const CTA_NUDGE_LIMIT = 18;

// Helpers
// ------------
const ctaPull = (gap: number) => Math.max(-CTA_NUDGE_LIMIT, Math.min(CTA_NUDGE_LIMIT, gap * CTA_NUDGE_STRENGTH));

// Look priority: sticky, cta, soft, link, then follow (inside the panel) or close (outside it)
const cursorLook = (target: Element, isSticky: boolean, overCta: Element | null, inside: boolean) => {
	if (isSticky) return 'sticky';
	if (target.closest('[data-cursor-drag]')) return 'drag';
	if (overCta) return 'cta';
	if (target.closest('[data-cursor-soft]')) return 'soft';
	if (target.closest('[data-cursor-link]')) return 'link';
	return inside ? 'follow' : 'close';
};

// Component
// ------------
// NOTE • The slide-in panel that holds the profile (or a mini case study), plus the
// custom cursor that follows the pointer while it's open. The page stays mounted
// as `scene` behind it, frozen while the panel is up.
const ProfileReveal = ({ children, profile, project }: I.ProfileRevealProps) => {
	// Context
	const { profileOpen, setProfileOpen, projectModalOpen, closeProjectModal, leaveProjectModal, lenisRef } =
		use(GlobalContext);
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
	// NOTE • Which content the panel shows — kept through the closing slide
	const [shown, setShown] = useState<'profile' | 'project'>('profile');

	// Derived
	const isOpen = profileOpen || projectModalOpen;
	const active = isOpen || presented;
	const isProject = shown === 'project';
	// NOTE • Profile sections set up the moment the panel opens, but tear down in a deferred
	// render after it has closed: otherwise the teardown (ScrollTriggers, WebGL scenes, images)
	// lands in the same commit that resumes the page behind it, and its first frames stutter.
	// The panel is already hidden by then; reopening before it runs keeps the sections alive.
	const profilePresent = active && !isProject;
	const keptPresent = useDeferredValue(profilePresent);
	const close = isProject ? closeProjectModal : () => setProfileOpen(false);
	// NOTE • Read by the keyboard handler without re-binding it each render
	const closeAction = useRef(close);
	closeAction.current = close;

	// Effects
	useEffect(() => {
		// Remember which content to show, so it survives the closing slide
		if (profileOpen) setShown('profile');
		else if (projectModalOpen) setShown('project');
	}, [profileOpen, projectModalOpen]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: new panel content brings new media to warm.
	useEffect(() => {
		if (isOpen && panelRef.current) return preloadNearbyMedia(panelRef.current);
	}, [isOpen, shown]);

	useEffect(() => {
		// Dev only: ?modalSettings loads the tweak panel on demand
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
		// Custom cursor: a follower that eases toward the pointer, stretches with its lag,
		// and changes look (data-cursor) depending on what's under it
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
		// Clears the stretch so the cursor returns to a plain circle
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

		// The custom cursor only shows for a mouse, over an open panel, away from dialogs
		const cursorApplies = (event: PointerEvent, target: Element, projectPanel: Element | null) => {
			// NOTE • A featured case study's open panel: the dimmed hero beside it closes, as a backdrop does
			const projectBackdrop =
				target.closest('[data-project-backdrop]') &&
				document.querySelector('[data-project-panel][data-open="true"]');
			if ((!isOpen && !projectPanel && !projectBackdrop) || target.closest('[data-modal-settings], dialog[open]'))
				return false;
			return mouse.matches && event.pointerType === 'mouse' && jacket.contains(target);
		};

		// Sticky targets pull the cursor to their centre, and can ask it to fit their box
		const applyStickyTarget = (stickyTarget: HTMLElement | null) => {
			if (stickyTarget) {
				const bounds = (
					stickyTarget.querySelector('[data-cursor-anchor]') ?? stickyTarget
				).getBoundingClientRect();
				targetX = bounds.left + bounds.width / 2;
				targetY = bounds.top + bounds.height / 2;
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
		};

		const nudgeTowardCta = (cta: Element) => {
			const bounds = cta.getBoundingClientRect();
			targetX += ctaPull(bounds.left + bounds.width / 2 - targetX);
			targetY += ctaPull(bounds.top + bounds.height / 2 - targetY);
		};

		// Glides to the target, or jumps there when appearing or with reduced motion
		const moveCursor = (snap: boolean) => {
			movement?.kill();
			if (!visible || reduced.matches) {
				position.x = targetX;
				position.y = targetY;
				deform();
			} else {
				movement = gsap.to(position, {
					x: targetX,
					y: targetY,
					duration: snap ? CURSOR_SNAP_DURATION : CURSOR_SPEED,
					ease: snap ? 'power2.out' : 'power3.out',
					onUpdate: deform,
				});
			}
			visible = true;
			deform();
		};

		// NOTE • Tracked from 'project-panel:change' so move() can skip its hit test while no
		// panel is open: cursorApplies() can only be true for an open profile or case-study panel
		let projectPanelOpen = Boolean(document.querySelector('[data-project-panel][data-open="true"]'));

		// Works out which cursor look applies under the pointer, then glides it there
		const move = (event: PointerEvent) => {
			lastPointer = event;
			// Same outcome as cursorApplies() returning false, without a hit test (this runs on
			// every pointer move and every scroll frame, site-wide)
			if ((!isOpen && !projectPanelOpen) || event.pointerType !== 'mouse' || !mouse.matches) {
				if (visible) hide();
				return;
			}
			const target = document.elementFromPoint(event.clientX, event.clientY);
			const projectPanel = target?.closest('[data-project-panel][data-open="true"]') ?? null;
			if (!target || !cursorApplies(event, target, projectPanel)) {
				hide();
				return;
			}
			const stickyTarget = target.closest<HTMLElement>('[data-cursor-sticky]');
			// Independent positioning keeps the glyph off the circle's eased animation path.
			gsap.set(closeCursorRef.current, { x: event.clientX, y: event.clientY });
			const wasSticky = jacket.dataset.cursor === 'sticky';
			const inside = Boolean(projectPanel || panelRef.current?.contains(target));

			targetX = event.clientX;
			targetY = event.clientY;
			applyStickyTarget(stickyTarget);
			const overCta = target.closest('[data-cursor-cta]');
			if (overCta && !reduced.matches) nudgeTowardCta(overCta);

			jacket.dataset.cursor = cursorLook(target, Boolean(stickyTarget), overCta, inside);
			moveCursor(Boolean(stickyTarget) || wasSticky);
		};

		window.addEventListener('pointermove', move);
		const refresh = () => {
			if (lastPointer) move(lastPointer);
		};
		const panelChange = () => {
			projectPanelOpen = Boolean(document.querySelector('[data-project-panel][data-open="true"]'));
			refresh();
		};
		window.addEventListener('project-panel:change', panelChange);
		window.addEventListener('scroll', refresh, true);
		window.addEventListener('blur', hide);
		document.addEventListener('pointerleave', hide);
		mouse.addEventListener('change', hide);
		return () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('project-panel:change', panelChange);
			window.removeEventListener('scroll', refresh, true);
			window.removeEventListener('blur', hide);
			document.removeEventListener('pointerleave', hide);
			mouse.removeEventListener('change', hide);
			hide();
		};
	}, [isOpen]);

	useEffect(() => {
		if (isOpen) {
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
				if (cancelled) return;
				setPresented(false);
				// NOTE • A closed project modal only now leaves its route (no-op after Back)
				leaveProjectModal();
			});
		});
		return () => {
			cancelled = true;
			cancelAnimationFrame(frame);
		};
	}, [isOpen, leaveProjectModal]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: switching content resets the panel's scroll.
	useLayoutEffect(() => {
		const wrapper = panelRef.current;
		const content = panelContentRef.current;
		if (!isOpen || !wrapper || !content) return;

		// Reset before the opening frame, including native/reduced-motion scrolling.
		wrapper.scrollTo({ top: 0, left: 0, behavior: 'instant' });
		if (isReducedMotion) return;

		// The panel gets its own Lenis, since the page's is stopped while it's open
		// NOTE • No touch listeners on touch-only devices: the panel scrolls natively there, and
		// they'd make every swipe wait for the main thread (see touchOnlyEventsTarget). The panel
		// never runs a programmatic smooth scroll, so nothing needs a finger to interrupt it.
		const eventsTarget = touchOnlyEventsTarget();
		const modalLenis = new Lenis({
			wrapper,
			content,
			autoRaf: false,
			syncTouch: false,
			...(eventsTarget && { eventsTarget }),
		});
		modalLenis.scrollTo(0, { immediate: true, force: true });
		// Steps on the vsync clock and runs first in the tick, like the page's Lenis (see
		// src/utils/frameClock.ts). The panel's scrubs update in the same frame as its scroll;
		// left to the native scroll event they landed one frame behind the content.
		const update = () => modalLenis.raf(smoothFrameTime());
		modalLenis.on('scroll', ScrollTrigger.update);
		gsap.ticker.add(update, false, true);

		return () => {
			gsap.ticker.remove(update);
			modalLenis.off('scroll', ScrollTrigger.update);
			modalLenis.destroy();
		};
	}, [isOpen, shown, isReducedMotion]);

	useEffect(() => {
		if (!active) return;
		const scene = sceneRef.current;
		if (!scene) return;
		// Pause everything animating on the page behind the panel, and resume it on close
		const animations = new Set<Animation>();
		const timelines = new Set<gsap.core.Animation>();
		// Running CSS transitions and Web Animations (CSS animations are paused by the stylesheet)
		const pauseAnimations = () => {
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
		};
		// NOTE • The same tweens gsap.getTweensOf(scene.querySelectorAll('*')) finds, without
		// comparing every page element against every tween's targets: only tweens on an element
		// `affected` accepts, each paused through its root timeline
		const pauseTweens = (affected: (target: Element) => boolean) => {
			for (const tween of gsap.globalTimeline.getChildren(true, true, false)) {
				const inScene = (target: unknown) => target instanceof Element && target !== scene && affected(target);
				if (!tween.targets().some(inScene)) continue;
				let animation: gsap.core.Animation = tween;
				while (animation.parent && animation.parent !== gsap.globalTimeline) animation = animation.parent;
				if (!animation.paused()) {
					timelines.add(animation);
					animation.pause();
				}
			}
		};
		pauseAnimations();
		pauseTweens(target => scene.contains(target));
		// Lazy content may start a reveal after the modal has already opened. Any attribute change
		// (a style, a class, a data-state) or added node can start a CSS transition, on that element
		// or an ancestor: the scene's animation list is cheap to rescan whole. A tween behind the
		// panel writes its target's style when it renders, so only tweens on what mutated are new.
		// (A gallery still animating behind the panel writes a style every frame; matching every
		// tween against the whole page each time cost far more.)
		const additions = new MutationObserver(records => {
			const roots: Element[] = [];
			for (const record of records) {
				if (record.type === 'attributes' && record.target instanceof Element) roots.push(record.target);
				for (const node of record.addedNodes) if (node instanceof Element) roots.push(node);
			}
			pauseAnimations();
			if (roots.length) pauseTweens(target => roots.some(root => root.contains(target)));
		});
		additions.observe(scene, { subtree: true, childList: true, attributes: true });
		return () => {
			additions.disconnect();
			for (const animation of animations) animation.play();
			for (const animation of timelines) if (animation.parent) animation.resume();
		};
	}, [active]);

	useEffect(() => {
		if (!active) return;
		// Lock page scroll, move focus into the panel and trap Tab inside it; all undone on close
		const previousFocus = document.activeElement;
		const page = document.getElementById('page');
		const overflow = page?.style.overflow;
		const lenis = lenisRef.current?.lenis;
		const wasStopped = lenis?.isStopped;
		const scrollRoot = lenis?.rootElement;
		const scrollOverflow = scrollRoot?.style.overflow ?? '';
		// Lenis' stopped class uses overflow: clip, which resets the pinned page's scroll.
		// Preserve its scroll container while the profile has its own scrolling instance.
		// NOTE • 'auto' (its own value) rather than 'hidden': an overflow: hidden box isn't user
		// scrollable, so browsers drop its composited scrolling and repaint the whole page on the
		// open frame. The page still can't scroll: it's inert, behind the overlay, Lenis is stopped.
		if (scrollRoot) scrollRoot.style.overflow = 'auto';
		lenis?.stop();
		if (page) page.style.overflow = 'hidden';
		closeRef.current?.focus({ preventScroll: true });

		const onKeyDown = (event: KeyboardEvent) => {
			if (document.querySelector('dialog[open]')) return;
			if (event.key === 'Escape') {
				event.preventDefault();
				closeAction.current();
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
	}, [active, lenisRef]);

	// Render
	// Both contents stay mounted; only the active one is shown
	return (
		<div ref={jacketRef} className={s.jacket} data-state={isOpen ? 'open' : active ? 'closing' : 'closed'}>
			{Settings && <Settings />}
			<div
				ref={panelRef}
				id='profile-panel'
				className={s.panel}
				role='dialog'
				aria-modal={active && !Settings ? true : undefined}
				aria-label={isProject ? 'Project' : 'Profile'}
				aria-hidden={!active}
				inert={!active}
			>
				<div ref={panelContentRef} className={s.panelContent}>
					<div className={s.toolbar}>
						<button
							ref={closeRef}
							type='button'
							className={s.closeButton}
							aria-label={isProject ? 'Close project' : 'Close profile'}
							data-cursor-sticky
							onClick={close}
						>
							<Image src='/images/reviews/arrow.svg' width={16} height={11} alt='' />
						</button>
					</div>
					<div className={s.content} hidden={isProject}>
						<ProfilePresenceContext.Provider value={profilePresent || keptPresent}>
							{profile ?? <div className={s.placeholder} aria-hidden='true' />}
						</ProfilePresenceContext.Provider>
					</div>
					<div className={s.content} hidden={!isProject}>
						{project}
					</div>
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
				aria-label={isProject ? 'Close project backdrop' : 'Close profile backdrop'}
				aria-hidden='true'
				tabIndex={-1}
				disabled={!isOpen}
				onClick={close}
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
						className={s.dragCursor}
						width='28'
						height='16'
						viewBox='0 0 28 16'
						fill='none'
						aria-hidden='true'
					>
						<path d='M7 3 2 8l5 5M21 3l5 5-5 5M2 8h24' stroke='currentColor' strokeWidth='1.5' />
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
