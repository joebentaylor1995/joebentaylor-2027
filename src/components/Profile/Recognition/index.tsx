'use client';

// Imports
// ------------
import { ProfilePresenceContext } from '@parts/ProfileReveal/context';
import { prepareScene } from '@utils/prepareScene';
import Image from 'next/image';
import { use, useEffect, useMemo, useRef } from 'react';
import type { ProfileImage } from '@/data/site';

// Styles
// ------------
import s from './styles.module.scss';

// Constants
// ------------
// NOTE • Shown instead of the spiral when WebGL is unavailable
const FALLBACK_POSTERS = 3;

// Component
// ------------
// Awards section: posters wound into a rising 3D spiral that the visitor can drag, scroll or
// inspect. The three.js engine loads lazily once the section is prepared; until then (or without
// WebGL) a few static posters are shown.
const Recognition = ({ intro, outro, awards }: { intro: string; outro: string; awards: ProfileImage[] }) => {
	// Context
	const present = use(ProfilePresenceContext);

	// Refs
	const sectionRef = useRef<HTMLElement>(null);

	// Derived
	// NOTE • Keyed on the URLs so a re-render with the same posters doesn't rebuild the scene
	const posterKey = awards.map(({ src }) => src).join('|');
	// biome-ignore lint/correctness/useExhaustiveDependencies: posterKey is the identity of awards
	const posters = useMemo(() => awards.map(({ src }) => src), [posterKey]);

	// Effects
	// Builds the scene when the profile is present, and pauses its rendering while off screen
	useEffect(() => {
		const section = sectionRef.current;
		if (!section || !present) return;

		const controller = new AbortController();
		let visible = false;
		let scene: ReturnType<typeof import('./engine').createRecognition> | undefined;

		// Import and create the scene when prepareScene says it is time; a failed import falls back to the static posters
		const stopPreparing = prepareScene(
			section,
			async () => {
				try {
					const { createRecognition } = await import('./engine');
					if (controller.signal.aborted) return;
					scene = createRecognition(section, controller.signal, posters);
					scene.setVisible(visible);
				} catch {
					if (!controller.signal.aborted) section.dataset.state = 'fallback';
				}
			},
			3
		);

		const observer = new IntersectionObserver(
			([entry]) => {
				visible = entry.isIntersecting;
				scene?.setVisible(visible);
			},
			{ root: section.closest('#profile-panel') }
		);
		observer.observe(section);

		return () => {
			controller.abort();
			stopPreparing();
			observer.disconnect();
			scene?.destroy();
			section.dataset.state = 'loading';
		};
	}, [present, posters]);

	// Render
	return (
		<section
			ref={sectionRef}
			className={s.jacket}
			data-recognition
			data-state='loading'
			aria-labelledby='recognition-title'
		>
			<div className={s.stage} data-recognition-stage>
				<div className={s.copy} data-recognition-copy='intro'>
					<h2 data-type='titleL' id='recognition-title' className={s.title}>
						Recognition
					</h2>
					<p data-type='bodyL' className={s.text}>
						{intro}
					</p>
				</div>
				<div className={s.copy} data-recognition-copy='outro'>
					<p data-type='bodyL' className={s.text}>
						{outro}
					</p>
				</div>
				<canvas
					className={s.canvas}
					data-recognition-canvas
					tabIndex={0}
					role='img'
					aria-label='Award posters in a rising spiral. Drag to explore, click an award or press Enter to inspect it. Escape returns it to the spiral.'
				/>
				<div className={s.fallback} aria-hidden='true'>
					{awards.slice(0, FALLBACK_POSTERS).map(({ src }) => (
						<Image
							key={src}
							src={src}
							width={420}
							height={595}
							alt=''
							loading='lazy'
							sizes='(min-width: 1024px) 260px, 29vw'
						/>
					))}
				</div>
				<div className={s.controls} data-recognition-controls>
					<button data-type='captionL' type='button' data-recognition-return hidden>
						Return to spiral
					</button>
				</div>
			</div>
		</section>
	);
};

// Exports
// ------------
Recognition.displayName = 'Recognition';
export default Recognition;
