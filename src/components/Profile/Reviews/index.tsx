'use client';

// Imports
// ------------
import { ProfilePresenceContext } from '@parts/ProfileReveal/context';
import SpecialHeading from '@parts/SpecialHeading';
import { splitStega } from '@utils/stega';
import Image from 'next/image';
import { use, useEffect, useRef, useState } from 'react';
import type { Review } from '@/data/site';

// Styles
// ------------
import s from './styles.module.scss';

// Component
// ------------
const Reviews = ({ reviews }: { reviews: Review[] }) => {
	// Context + Refs
	const present = use(ProfilePresenceContext);
	const sectionRef = useRef<HTMLElement>(null);
	const navigateRef = useRef<((direction: number) => void) | null>(null);
	const [active, setActive] = useState(0);

	// Effects
	useEffect(() => {
		const section = sectionRef.current;
		if (!present || !section) return;
		let cancelled = false;
		let destroy: (() => void) | undefined;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return;
				observer.disconnect();
				void import('./motion').then(({ createReviews }) => {
					if (cancelled) return;
					const motion = createReviews(section, setActive);
					navigateRef.current = motion.navigate;
					destroy = motion.destroy;
				});
			},
			{ root: section.closest('#profile-panel'), rootMargin: '200px' }
		);
		observer.observe(section);
		return () => {
			cancelled = true;
			observer.disconnect();
			navigateRef.current = null;
			destroy?.();
		};
	}, [present]);

	// Derived
	// NOTE • SplitText splits each quote's clean text; the Visual Editing payload
	// is rendered beside it so the quote stays click-to-edit
	const quotes = reviews.map(({ quote }) => splitStega(quote));

	// Handlers
	const navigate = (direction: number) => {
		if (navigateRef.current) navigateRef.current(direction);
		else setActive(index => (index + direction + reviews.length) % reviews.length);
	};

	// Render
	return (
		<section
			ref={sectionRef}
			className={s.jacket}
			data-reviews
			data-active-review={active}
			aria-label='Reviews'
			aria-roledescription='carousel'
		>
			<div className={s.controls}>
				<SpecialHeading text='Reviews' revealOnView />
				<div className={s.buttons}>
					<button
						type='button'
						onClick={() => navigate(-1)}
						aria-label='Previous review'
						data-cursor-sticky
						aria-controls='profile-review-slides'
					>
						<Image src='/images/reviews/arrow.svg' width={16} height={11} alt='' />
					</button>
					<button
						type='button'
						onClick={() => navigate(1)}
						aria-label='Next review'
						data-cursor-sticky
						aria-controls='profile-review-slides'
					>
						<Image src='/images/reviews/arrow.svg' width={16} height={11} alt='' />
					</button>
				</div>
			</div>
			<div id='profile-review-slides' className={s.slides} data-review-slides>
				{reviews.map((review, index) => (
					<figure
						key={review.image}
						className={s.slide}
						data-review-slide
						data-active={active === index}
						aria-hidden={active !== index}
					>
						{/* NOTE • The quote is split into lines, so Visual Editing outlines the whole quote */}
						<blockquote data-type='bodyL' className={s.quote} data-sanity-edit-target>
							<p data-review-quote>{quotes[index].clean}</p>
							{quotes[index].encoded}
						</blockquote>
						<figcaption className={s.author}>
							<div className={s.portrait}>
								<div className={s.face} data-review-face>
									<Image src={review.image} fill sizes='64px' alt={review.author} />
								</div>
								{review.logo && (
									<span className={s.logo} data-review-logo>
										<Image src={review.logo} fill sizes='24px' alt={review.company} />
									</span>
								)}
							</div>
							<div data-type='bodyM' className={s.details}>
								<div className={s.mask}>
									<p data-review-detail>{review.author}</p>
								</div>
								<div className={s.mask}>
									<p className={s.company} data-review-detail>
										{review.company}
									</p>
								</div>
							</div>
						</figcaption>
					</figure>
				))}
			</div>
			<p className={s.status} aria-live='polite' aria-atomic='true'>
				Review {active + 1} of {reviews.length}: {reviews[active].quote} — {reviews[active].author},{' '}
				{reviews[active].company}
			</p>
		</section>
	);
};

// Exports
// ------------
Reviews.displayName = 'Reviews';
export default Reviews;
