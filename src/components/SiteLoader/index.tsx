'use client';

// Imports
// ------------
import Logo from '@parts/Logo';
import { useAnimation } from '@utils/useAnimation';
import { gsap } from 'gsap';
import { useId, useRef } from 'react';
import { revealScene } from './events';

// Styles
// ------------
import s from './styles.module.scss';

// Component
// ------------
const SiteLoader = () => {
	// Refs
	const ref = useRef<HTMLDivElement>(null);
	const finished = useRef(false);
	const id = useId().replaceAll(':', '');

	// Animations
	useAnimation(
		({ reduced }) => {
			const root = ref.current;
			if (!root) return;
			if (finished.current) {
				gsap.set(root, { autoAlpha: 0, pointerEvents: 'none' });
				return;
			}
			const circle = root.querySelector('[data-circle-aperture]');
			const wash = root.querySelector('[data-logo-wash]');
			const mark = root.querySelector('[data-loader-mark]');
			const ring = root.querySelector('[data-loader-ring]');
			const logoWidth = mark?.getBoundingClientRect().width || 120;
			const width = window.innerWidth;
			const height = window.innerHeight;
			gsap.set(root, { autoAlpha: 1, pointerEvents: 'auto' });
			gsap.set(circle, { attr: { cx: width / 2, cy: height / 2, r: 0 } });
			gsap.set(wash, { attr: { r: 0 } });
			gsap.set(ring, { scale: 0, opacity: 0 });
			const tl = gsap.timeline({
				paused: true,
				onComplete: () => {
					finished.current = true;
					root.dataset.complete = 'true';
				},
			});
			if (reduced) {
				tl.call(revealScene).to(root, { autoAlpha: 0, pointerEvents: 'none', duration: 0.15 });
			} else {
				// One wavefront removes the stationary logo and opens the scene.
				const wave = { radius: 0 };
				const setRingScale = gsap.quickSetter(ring, 'scale');
				tl.call(revealScene, [], 0.65)
					.set(ring, { opacity: 0.45 }, 0.65)
					.to(
						wave,
						{
							radius: Math.hypot(width, height),
							duration: 1.35,
							ease: 'power2.inOut',
							onUpdate: () => {
								setRingScale(wave.radius / 100);
								circle?.setAttribute('r', String(wave.radius));
								wash?.setAttribute('r', String(wave.radius / (logoWidth / 68)));
							},
						},
						0.65
					)
					.to(ring, { opacity: 0, duration: 0.45 }, 1.55)
					.set(root, { autoAlpha: 0, pointerEvents: 'none' }, 2);
			}
			// Wait for first-view assets, with a deadline for slow or failed requests.
			let active = true;
			let started = false;
			const start = () => {
				if (!active || started) return;
				started = true;
				window.clearTimeout(deadline);
				tl.play();
			};
			const deadline = window.setTimeout(start, 1500);
			const images = Array.from(document.images).filter(
				image => image.loading === 'eager' || image.fetchPriority === 'high'
			);
			void Promise.all([
				document.fonts.ready,
				...images.map(image => image.decode().catch(() => undefined)),
			]).then(start, start);
			return () => {
				active = false;
				window.clearTimeout(deadline);
			};
		},
		{ scope: ref },
		{ reduced: '(prefers-reduced-motion: reduce)' }
	);

	// Render
	return (
		<div ref={ref} className={s.jacket} data-site-loader data-loader-overlay aria-hidden='true'>
			<svg className={s.veil} width='100%' height='100%' aria-hidden='true'>
				<defs>
					<mask id={`${id}-scene`} maskUnits='userSpaceOnUse'>
						<rect width='100%' height='100%' fill='white' />
						<circle data-circle-aperture r='0' fill='black' />
					</mask>
				</defs>
				<rect width='100%' height='100%' className={s.dark} mask={`url(#${id}-scene)`} />
			</svg>
			<div className={s.centre}>
				<div className={s.mark} data-loader-mark>
					<svg className={s.logoViewport} viewBox='0 0 68 26' aria-hidden='true'>
						<defs>
							<filter id={`${id}-edge`} x='-50%' y='-50%' width='200%' height='200%'>
								<feGaussianBlur stdDeviation='1.2' />
							</filter>
							<mask id={`${id}-logo`} maskUnits='userSpaceOnUse' x='-68' y='-68' width='204' height='162'>
								<rect x='-68' y='-68' width='204' height='162' fill='white' />
								<circle data-logo-wash cx='34' cy='13' r='0' fill='black' filter={`url(#${id}-edge)`} />
							</mask>
						</defs>
						<g mask={`url(#${id}-logo)`}>
							<Logo className={s.logo} />
						</g>
					</svg>
				</div>
			</div>
			<div className={s.ring} data-loader-ring />
			<noscript>
				<style>{`.${s.jacket}{display:none}`}</style>
			</noscript>
		</div>
	);
};

export default SiteLoader;
