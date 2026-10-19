'use client';

// Imports
// ------------
import { ProfilePresenceContext } from '@parts/ProfileReveal/context';
import { useAnimation } from '@utils/useAnimation';
import { gsap } from 'gsap';
import { use, useRef } from 'react';

// Styles
// ------------
import s from './styles.module.scss';

const OPEN_DELAY = 0.65;
const FILL_DURATION = 1.1;
const LINE_STAGGER = 0.25;
const FILL_START = -16;
const FILL_END = 111;

// Component
// ------------
// NOTE • One fill-wave line per entry — from the Profile panel's “Title” field
const Title = ({ lines }: { lines: string[] }) => {
	// Context
	const present = use(ProfilePresenceContext);

	// Refs
	const ref = useRef<HTMLParagraphElement>(null);
	const revealed = useRef(false);

	// Animations
	useAnimation(
		({ reduced }) => {
			const root = ref.current;
			if (!root) return;
			const text = root.querySelectorAll('[data-title-text]');
			if (!present) revealed.current = false;
			gsap.set(text, { '--tfw-fill': reduced || revealed.current ? FILL_END : FILL_START });
			if (!present || reduced || revealed.current) return;
			const timeline = gsap.timeline({
				delay: OPEN_DELAY,
				onComplete: () => {
					revealed.current = true;
				},
			});
			text.forEach((word, index) => {
				const start = index * LINE_STAGGER;
				timeline.to(word, { '--tfw-fill': FILL_END, duration: FILL_DURATION, ease: 'expo.out' }, start);
			});
		},
		{ scope: ref, dependencies: [present, lines], revertOnUpdate: true },
		{ reduced: '(prefers-reduced-motion: reduce)' }
	);

	// Render
	return (
		<p
			ref={ref}
			className={s.jacket}
			data-type='displayL'
			data-profile-title
			data-anm-text-fill-wave
			data-anm-tfw-headline
		>
			{lines.map((line, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: lines can repeat; order is the identity
				<span key={index} className={s.line} data-title-text>
					{line}
				</span>
			))}
		</p>
	);
};

// Exports
// ------------
Title.displayName = 'ProfileTitle';
export default Title;
