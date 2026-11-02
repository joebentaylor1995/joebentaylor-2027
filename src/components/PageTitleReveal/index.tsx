'use client';

// Imports
// ------------
import { isLoaderSettled, LOADER_RESET, LOADER_SETTLED } from '@parts/SiteLoader/events';
import { isProjectHandoffPending, PROJECT_HANDOFF_SETTLED } from '@utils/projectHandoff';
import { splitStega } from '@utils/stega';
import { useAnimation } from '@utils/useAnimation';
import { gsap } from 'gsap';
import { type CSSProperties, useRef } from 'react';

// Styles + Interfaces
// ------------
import type { PageTitleRevealProps } from './interface';
import s from './styles.module.scss';

// Constants
// ------------
// NOTE • The words reveal runs in CSS — a GSAP tween per word read every word's
// computed style on mount, a forced style recalc that stalled the first scroll.
// Keep these in step with --word-duration and --word-stagger in styles.module.scss.
const WORD_DURATION = 0.85;
const WORD_STAGGER = 0.025;
const BLOCK_DURATION = 0.45;
const BLOCK_DURATION_PROJECT = 0.3;
// Range of the --tfw-fill percentage the wave variant tweens through
const WAVE_FILL_START = -16;
const WAVE_FILL_END = 111;
const DEFAULT_WAVE_DURATION = 1.1;
const VIEW_TRIGGER_RATIO = 0.3;

// Component
// ------------
// NOTE • Reveals a title once something lets it: the site loader settling, the
// title scrolling into view, or a project handoff finishing. data-wave-state
// moves from waiting to playing to complete, which the SCSS reads. Three variants: a wave fill, a
// sliding block, or word-by-word in CSS.
const PageTitleReveal = ({
	children,
	variant = 'wave',
	trigger = 'loader',
	replay = false,
	transparentStart = false,
	waveDuration = DEFAULT_WAVE_DURATION,
	waveEase = 'expo.out',
	waveDelay = 0,
}: PageTitleRevealProps) => {
	// Refs
	const ref = useRef<HTMLSpanElement>(null);
	const finished = useRef(false);

	// Animations
	useAnimation(
		({ reduced }) => {
			const title = ref.current;
			if (!title) return;
			// Activity restores project pages with their refs intact. Each entrance
			// gets a fresh reveal, even if this title completed on an earlier visit.
			if (trigger === 'project') finished.current = false;

			// Marks the reveal done and tells listeners (bubbles) that the title is ready
			const complete = () => {
				finished.current = true;
				title.dataset.waveState = 'complete';
				title.dispatchEvent(new Event('page-title:revealed', { bubbles: true }));
			};

			// Reduced motion, or already revealed: show the final state straight away
			if (reduced || finished.current) {
				complete();
				return;
			}
			title.dataset.waveState = 'waiting';
			const wordCount = title.querySelectorAll('[data-reveal-word]').length;
			// Built paused; `start` below plays it
			const tween =
				variant === 'words'
					? // A plain timer tween, not delayedCall: a paused delay doesn't survive replays
						gsap.to(
							{},
							{
								duration: WORD_DURATION + WORD_STAGGER * Math.max(0, wordCount - 1),
								paused: true,
								onComplete: complete,
							}
						)
					: variant === 'block'
						? gsap
								.timeline({ paused: true, onComplete: complete })
								.set(title, { '--block-scale': 0, '--block-origin': '0%', '--block-text': 0 })
								.to(title, {
									'--block-scale': 1,
									duration: trigger === 'project' ? BLOCK_DURATION_PROJECT : BLOCK_DURATION,
									ease: 'power3.inOut',
								})
								.set(title, { '--block-origin': '100%', '--block-text': 1 })
								.to(title, {
									'--block-scale': 0,
									duration: trigger === 'project' ? BLOCK_DURATION_PROJECT : BLOCK_DURATION,
									ease: 'power3.inOut',
								})
						: gsap.timeline({ paused: true, onComplete: complete }).fromTo(
								title,
								{ '--tfw-fill': WAVE_FILL_START },
								{
									'--tfw-fill': WAVE_FILL_END,
									duration: waveDuration,
									ease: waveEase,
								},
								waveDelay
							);

			// Rewinds to the start, ready to play again
			const rewind = () => {
				finished.current = false;
				tween.pause(0);
				title.dataset.waveState = 'waiting';
			};

			// Plays once, and not at all while a project handoff is still covering the page
			const start = () => {
				if (finished.current || title.dataset.waveState === 'playing') return;
				if (trigger === 'project' && isProjectHandoffPending()) return;
				title.dataset.waveState = 'playing';
				tween.play();
			};

			// Scroll trigger: play when 30% visible; with `replay` it rewinds once it leaves view
			if (trigger === 'view') {
				const observer = new IntersectionObserver(
					entries => {
						// Fast scrolls can cross multiple thresholds in one callback.
						const entry = entries[entries.length - 1];
						if (replay && !entry.isIntersecting) {
							rewind();
							return;
						}
						if (!entry.isIntersecting || entry.intersectionRatio < VIEW_TRIGGER_RATIO) return;
						start();
						if (!replay) observer.disconnect();
					},
					{ threshold: [0, VIEW_TRIGGER_RATIO] }
				);
				observer.observe(title);
				return () => observer.disconnect();
			}

			// Loader and handoff triggers: play now if the loader is done, else wait for its events
			if (isLoaderSettled()) start();
			const reset = () => {
				rewind();
				title.dispatchEvent(new Event('page-title:revealed', { bubbles: true }));
			};

			window.addEventListener(LOADER_SETTLED, start);
			if (trigger === 'project') window.addEventListener(PROJECT_HANDOFF_SETTLED, start);
			window.addEventListener(LOADER_RESET, reset);
			return () => {
				window.removeEventListener(LOADER_SETTLED, start);
				window.removeEventListener(PROJECT_HANDOFF_SETTLED, start);
				window.removeEventListener(LOADER_RESET, reset);
			};
		},
		{ scope: ref },
		{ reduced: '(prefers-reduced-motion: reduce)' }
	);

	// Derived
	// NOTE • Words are split from the clean text; the Visual Editing payload is
	// rendered once, intact, so the whole reveal stays click-to-edit
	const words = variant === 'words' && typeof children === 'string' ? splitStega(children) : null;
	let wordIndex = 0;

	// Render
	return (
		// NOTE • Text is split into words, so Visual Editing outlines the whole reveal, not one word
		<span
			ref={ref}
			className={s.jacket}
			data-page-title-reveal
			data-reveal-variant={variant}
			data-transparent-start={transparentStart || undefined}
			data-sanity-edit-target
		>
			<span>
				{words
					? Array.from(words.clean.matchAll(/\S+|\s+/g), match =>
							/\s+/.test(match[0]) ? (
								match[0]
							) : (
								<span key={match.index} className={s.wordMask}>
									<span data-reveal-word style={{ '--word-index': wordIndex++ } as CSSProperties}>
										{match[0]}
									</span>
								</span>
							)
						)
					: children}
			</span>
			{words?.encoded}
		</span>
	);
};

// Exports
// ------------
export default PageTitleReveal;
