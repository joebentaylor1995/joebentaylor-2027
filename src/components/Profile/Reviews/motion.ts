import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

// NOTE • The company badge follows the portrait in with the same tween, a beat later
const LOGO_DELAY = 0.12;
const PORTRAIT_IN = { scale: 1, opacity: 1, duration: 0.55, ease: 'power3.out' };
const PORTRAIT_OUT = { scale: 0, opacity: 0, duration: 0.3, ease: 'power2.in' };

export function createReviews(section: HTMLElement, onChange: (index: number) => void) {
	const slides = Array.from(section.querySelectorAll<HTMLElement>('[data-review-slide]'));
	let active = Number(section.dataset.activeReview) || 0;
	let navigate = (_direction: number) => {};
	const media = gsap.matchMedia();
	section.dataset.enhanced = 'true';
	media.add(
		{ reduced: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)' },
		context => {
			const reduced = context.conditions?.reduced;
			let timeline: gsap.core.Timeline | undefined;
			let busy = false;
			const splits = reduced
				? []
				: slides.map(slide =>
						SplitText.create(slide.querySelector('[data-review-quote]'), {
							type: 'lines',
							mask: 'lines',
							autoSplit: true,
							onSplit: () => {
								if (busy) timeline?.progress(1);
							},
						})
					);
			const details = (index: number) => slides[index].querySelectorAll('[data-review-detail]');
			// NOTE • Portrait and badge animate separately so the badge can trail;
			// querySelectorAll keeps a review without a logo a no-op, not a GSAP warning
			const face = (index: number) => slides[index].querySelectorAll('[data-review-face]');
			const logo = (index: number) => slides[index].querySelectorAll('[data-review-logo]');
			gsap.set(slides, { autoAlpha: 0 });
			gsap.set(slides[active], { autoAlpha: 1 });
			navigate = direction => {
				if (busy) return;
				const previous = active;
				const next = (active + direction + slides.length) % slides.length;
				const complete = () => {
					gsap.set(slides[previous], { autoAlpha: 0 });
					gsap.set(slides[next], { autoAlpha: 1 });
					active = next;
					onChange(next);
					busy = false;
					section.dataset.animating = 'false';
				};
				// Interaction-created tweens join the same context for Profile close/reopen cleanup.
				context.add(() => {
					if (reduced) {
						complete();
						return;
					}
					busy = true;
					section.dataset.animating = 'true';
					gsap.set(slides[next], { autoAlpha: 1 });
					gsap.set(splits[next].lines, { yPercent: direction * 110 });
					gsap.set(details(next), { yPercent: direction * 110 });
					gsap.set([face(next), logo(next)], { scale: 0, opacity: 0 });
					timeline = gsap.timeline({ onComplete: complete });
					timeline
						.to(
							splits[previous].lines,
							{ yPercent: direction * -110, duration: 0.4, stagger: 0.035, ease: 'power3.inOut' },
							0
						)
						.to(
							details(previous),
							{ yPercent: direction * -110, duration: 0.3, stagger: 0.04, ease: 'power2.in' },
							0
						)
						.to([face(previous), logo(previous)], PORTRAIT_OUT, 0)
						.to(
							splits[next].lines,
							{ yPercent: 0, duration: 0.65, stagger: 0.045, ease: 'power3.out' },
							0.32
						)
						.to(details(next), { yPercent: 0, duration: 0.5, stagger: 0.05, ease: 'power3.out' }, 0.42)
						.to(face(next), PORTRAIT_IN, 0.32)
						.to(logo(next), PORTRAIT_IN, 0.32 + LOGO_DELAY);
				});
			};
			return () => {
				for (const split of splits) split.revert();
				section.dataset.animating = 'false';
			};
		}
	);
	return {
		navigate: (direction: number) => navigate(direction),
		destroy: () => {
			media.revert();
			delete section.dataset.enhanced;
			delete section.dataset.animating;
		},
	};
}
