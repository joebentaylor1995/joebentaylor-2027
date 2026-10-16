'use client';

// Imports
// ------------
import { ProfilePresenceContext } from '@parts/ProfileReveal/context';
import Image from 'next/image';
import { use, useEffect, useRef } from 'react';

// Styles
// ------------
import s from './styles.module.scss';

// Component
// ------------
const Recognition = () => {
	// Context + Refs
	const present = use(ProfilePresenceContext);
	const sectionRef = useRef<HTMLElement>(null);

	// Effects
	useEffect(() => {
		const section = sectionRef.current;
		if (!section || !present) return;
		const controller = new AbortController();
		let loading = false;
		let visible = false;
		let scene: ReturnType<typeof import('./engine').createRecognition> | undefined;
		const observer = new IntersectionObserver(
			([entry]) => {
				visible = entry.isIntersecting;
				scene?.setVisible(visible);
				if (!visible || loading) return;
				loading = true;
				void import('./engine')
					.then(({ createRecognition }) => {
						if (controller.signal.aborted) return;
						scene = createRecognition(section, controller.signal);
						scene.setVisible(visible);
					})
					.catch(() => {
						if (!controller.signal.aborted) section.dataset.state = 'fallback';
					});
			},
			{ root: section.closest('#profile-panel') }
		);
		observer.observe(section);
		return () => {
			controller.abort();
			observer.disconnect();
			scene?.destroy();
			section.dataset.state = 'loading';
		};
	}, [present]);

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
						I’ve been fortunate to earn recognition — both individually and as part of incredible teams.
					</p>
				</div>
				<div className={s.copy} data-recognition-copy='outro'>
					<p data-type='bodyL' className={s.text}>
						Awards aren’t everything, but they’re a reminder that the work is connecting with people in the
						right way.
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
					{['01', '05', '06'].map(id => (
						<Image
							key={id}
							src={`/images/recognition/award-${id}.jpg`}
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
