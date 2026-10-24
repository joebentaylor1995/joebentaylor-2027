'use client';

import { HERO_PARALLAX_COMPENSATION } from '@parts/ProjectHero/framing';

import { mq } from '@tackl';
// Imports
// ------------
import { useAnimation } from '@utils/useAnimation';
import { gsap } from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { useLenis } from 'lenis/react';
import { useRef } from 'react';

// Styles + Interfaces
// ------------
import type { ProjectExperienceProps } from './interface';
import s from './styles.module.scss';

gsap.registerPlugin(ScrollTrigger);

// Component
// ------------
const ProjectExperience = ({ hero, children }: ProjectExperienceProps) => {
	// Refs
	const ref = useRef<HTMLDivElement>(null);
	const returnRef = useRef<HTMLButtonElement>(null);
	const lenis = useLenis();

	// Handlers
	const returnToTop = () => {
		if (lenis) lenis.scrollTo(0, { duration: 1.6 });
		else window.scrollTo({ top: 0, behavior: 'smooth' });
	};

	// Animations
	useAnimation(
		() => {
			const root = ref.current;
			if (!root || !lenis) return;
			const media = gsap.matchMedia();
			const outro = root.querySelector<HTMLElement>('[data-project-outro]');
			media.add(`${mq.down.l} and (prefers-reduced-motion: no-preference)`, () => {
				const heroLayer = root.querySelector<HTMLElement>('[data-project-hero-layer]');
				if (!heroLayer) return;
				const measureHero = () => {
					root.style.setProperty(
						'--mobile-hero-top',
						`${Math.min(0, lenis.rootElement.clientHeight - heroLayer.offsetHeight)}px`
					);
				};
				const resize = new ResizeObserver(measureHero);
				resize.observe(heroLayer);
				resize.observe(lenis.rootElement);
				measureHero();
				const panel = root.querySelector<HTMLElement>('[data-project-panel]');
				const copy = heroLayer.querySelectorAll('[data-project-hero-copy]');
				const hero = heroLayer.querySelector<HTMLElement>('[data-project-hero]');
				if (panel) {
					gsap.to(copy, {
						y: () => -lenis.rootElement.clientHeight,
						ease: 'none',
						onUpdate: () => {
							if (copy[0])
								hero?.style.setProperty(
									'--project-copy-offset',
									String(gsap.getProperty(copy[0], 'y'))
								);
						},
						scrollTrigger: {
							trigger: panel,
							scroller: lenis.rootElement,
							start: 'top bottom',
							end: 'top top',
							scrub: true,
							invalidateOnRefresh: true,
						},
					});
				}
				return () => {
					resize.disconnect();
					hero?.style.removeProperty('--project-copy-offset');
					root.style.removeProperty('--mobile-hero-top');
				};
			});
			media.add(`${mq.down.l} and (prefers-reduced-motion: no-preference)`, () => {
				if (!outro) return;
				gsap.fromTo(
					outro,
					{ '--project-outro-progress': 0 },
					{
						'--project-outro-progress': 1,
						ease: 'none',
						scrollTrigger: {
							trigger: outro,
							scroller: lenis.rootElement,
							start: () => `bottom bottom+=${lenis.rootElement.clientHeight * 0.35}`,
							end: 'bottom bottom',
							scrub: true,
						},
					}
				);
			});
			media.add(`${mq.up.l} and (prefers-reduced-motion: no-preference)`, () => {
				const stage = root.querySelector<HTMLElement>('[data-project-stage]');
				const heroLayer = root.querySelector<HTMLElement>('[data-project-hero-layer]');
				const heroMedia = root.querySelector<HTMLElement>('[data-project-hero-media]');
				const hero = root.querySelector<HTMLElement>('[data-project-hero]');
				const panel = root.querySelector<HTMLElement>('[data-project-panel]');
				const content = root.querySelector<HTMLElement>('[data-project-panel-content]');
				const objectives = root.querySelector<HTMLElement>('[data-objectives-layout]');
				const label = root.querySelector<HTMLElement>('[data-objectives-label]');
				const shade = returnRef.current;
				if (!stage || !heroLayer || !heroMedia || !panel || !content || !shade) return;
				const parallaxCompensation = HERO_PARALLAX_COMPENSATION;
				root.dataset.enhanced = 'true';
				let heroTravel = 0,
					revealTravel = 0,
					contentTravel = 0;
				let labelBottom = 0,
					labelTravel = 0,
					labelGap = 40;
				const measure = () => {
					heroTravel = Math.max(0, heroLayer.offsetHeight - stage.clientHeight);
					// Extend above the hero so the slower image never reveals an empty edge.
					gsap.set(heroMedia, { top: -heroTravel * parallaxCompensation });
					revealTravel = stage.clientHeight * 0.9;
					contentTravel = Math.max(0, content.scrollHeight - stage.clientHeight);
					if (objectives && label) {
						const css = getComputedStyle(objectives);
						const paddingBottom = Number.parseFloat(css.paddingBottom);
						labelGap = Number.parseFloat(getComputedStyle(label).bottom) || 40;
						labelBottom =
							objectives.getBoundingClientRect().bottom -
							content.getBoundingClientRect().top -
							paddingBottom;
						labelTravel = Math.max(
							0,
							objectives.clientHeight -
								Number.parseFloat(css.paddingTop) -
								paddingBottom -
								label.offsetHeight
						);
					}
					return heroTravel + revealTravel + contentTravel;
				};
				measure();
				const update = (raw: number) => {
					// The hero has no scroll of its own, so the reveal starts at 0px. Sub-pixel
					// ScrollTrigger rounding at the top must not open it: the return-to-top
					// layer would then cover the hero and catch its clicks.
					const scroll = raw < 1 ? 0 : raw;
					const contentScroll = gsap.utils.clamp(0, contentTravel, scroll - heroTravel - revealTravel);
					const reveal = gsap.utils.clamp(0, 1, (scroll - heroTravel) / revealTravel);
					const textFade = gsap.utils.clamp(0, 1, reveal / 0.7);
					const imageFade = gsap.utils.clamp(0, 1, reveal / 0.4);
					hero?.style.setProperty(
						'--project-image-saturation',
						String(1 - imageFade * imageFade * (3 - 2 * imageFade))
					);
					hero?.style.setProperty(
						'--project-text-opacity',
						String(1 - textFade * textFade * (3 - 2 * textFade))
					);
					gsap.set(heroLayer, {
						y: -Math.min(scroll, heroTravel),
						xPercent: -12 * reveal,
					});
					gsap.set(heroMedia, { y: Math.min(scroll, heroTravel) * parallaxCompensation });
					gsap.set(panel, { xPercent: 100 * (1 - reveal) });
					gsap.set(content, { y: -contentScroll });
					if (label)
						gsap.set(label, {
							y: gsap.utils.clamp(
								-labelTravel,
								0,
								contentScroll + stage.clientHeight - labelGap - labelBottom
							),
						});
					if (outro) {
						const progress = gsap.utils.clamp(
							0,
							1,
							1 - (contentTravel - contentScroll) / (stage.clientHeight * 0.35)
						);
						outro.style.setProperty('--project-outro-progress', String(progress));
					}
					gsap.set(shade, { opacity: reveal * 0.85 });
					panel.inert = reveal === 0;
					const open = String(reveal >= 1);
					if (panel.dataset.open !== open) {
						panel.dataset.open = open;
						window.dispatchEvent(new Event('project-panel:change'));
					}
					shade.disabled = reveal === 0;
				};
				update(0);
				ScrollTrigger.create({
					trigger: stage,
					scroller: lenis.rootElement,
					start: 'top top',
					end: () => `+=${measure()}`,
					pin: true,
					invalidateOnRefresh: true,
					onUpdate: self => update(self.progress * (self.end - self.start)),
					onRefresh: self => update(self.progress * (self.end - self.start)),
				});
				return () => {
					gsap.set([heroLayer, panel, content, shade], { clearProps: 'transform,opacity' });
					gsap.set(heroMedia, { clearProps: 'transform,top' });
					if (label) gsap.set(label, { clearProps: 'transform' });
					hero?.style.removeProperty('--project-text-opacity');
					hero?.style.removeProperty('--project-image-saturation');
					outro?.style.removeProperty('--project-outro-progress');
					delete root.dataset.enhanced;
					panel.inert = false;
					delete panel.dataset.open;
					window.dispatchEvent(new Event('project-panel:change'));
					shade.disabled = true;
				};
			});
		},
		{ scope: ref, dependencies: [lenis], revertOnUpdate: true }
	);

	// Render
	return (
		<div ref={ref} className={s.jacket} data-project-experience>
			<div className={s.stage} data-project-stage>
				<div className={s.hero} data-project-hero-layer>
					{hero}
				</div>
				<button
					ref={returnRef}
					type='button'
					className={s.returnToTop}
					aria-label='Return to the top of the project'
					onClick={returnToTop}
				/>
				<section className={s.panel} aria-label='Project details' data-project-panel>
					<div data-project-panel-content>{children}</div>
				</section>
			</div>
		</div>
	);
};

// Exports
// ------------
export default ProjectExperience;
