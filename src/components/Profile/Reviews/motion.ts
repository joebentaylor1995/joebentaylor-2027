// Imports
// ------------
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

// Plugins
// ------------
gsap.registerPlugin(SplitText);

// Constants
// ------------
// NOTE • The company badge follows the portrait in with the same tween, a beat later
const LOGO_DELAY = 0.12;
const PORTRAIT_IN = { scale: 1, opacity: 1, duration: 0.55, ease: 'power3.out' };
const PORTRAIT_OUT = { scale: 0, opacity: 0, duration: 0.3, ease: 'power2.in' };

// How far (%) text travels out of view, in the direction of travel
const TEXT_TRAVEL = 110;

// Tweens leaving the old slide, and arriving on the new one with their start times
const LINES_OUT = { duration: 0.4, stagger: 0.035, ease: 'power3.inOut' };
const DETAILS_OUT = { duration: 0.3, stagger: 0.04, ease: 'power2.in' };
const LINES_IN = { duration: 0.65, stagger: 0.045, ease: 'power3.out' };
const DETAILS_IN = { duration: 0.5, stagger: 0.05, ease: 'power3.out' };
const INCOMING_START = 0.32;
const DETAILS_IN_START = 0.42;

// Exports
// ------------
// ANCHOR • Adds the slide transitions to a reviews section; `navigate` steps by +1 / -1 and `destroy` undoes everything
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

			// Quotes are split into masked lines for the slide; under reduced motion slides simply swap
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

			// Only the active slide is visible
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

					// Park the incoming text and portrait off-screen in the direction of travel
					gsap.set(splits[next].lines, { yPercent: direction * TEXT_TRAVEL });
					gsap.set(details(next), { yPercent: direction * TEXT_TRAVEL });
					gsap.set([face(next), logo(next)], { scale: 0, opacity: 0 });

					// Outgoing content leaves first; the incoming content overlaps it
					timeline = gsap.timeline({ onComplete: complete });
					timeline
						.to(splits[previous].lines, { yPercent: direction * -TEXT_TRAVEL, ...LINES_OUT }, 0)
						.to(details(previous), { yPercent: direction * -TEXT_TRAVEL, ...DETAILS_OUT }, 0)
						.to([face(previous), logo(previous)], PORTRAIT_OUT, 0)
						.to(splits[next].lines, { yPercent: 0, ...LINES_IN }, INCOMING_START)
						.to(details(next), { yPercent: 0, ...DETAILS_IN }, DETAILS_IN_START)
						.to(face(next), PORTRAIT_IN, INCOMING_START)
						.to(logo(next), PORTRAIT_IN, INCOMING_START + LOGO_DELAY);
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
