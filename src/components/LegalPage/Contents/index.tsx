'use client';

// Imports
// ------------
import { GlobalContext } from '@parts/Contexts';
import SpecialHeading from '@parts/SpecialHeading';
import { type MouseEvent, use } from 'react';

// Styles + Interfaces
// ------------
import type * as I from '../interface';
import s from './styles.module.scss';

// Component
// ------------
const Contents = ({ sections, className }: { sections: I.LegalSection[]; className?: string }) => {
	// Context
	const { lenisRef } = use(GlobalContext);

	// Handlers
	// NOTE • Lenis owns the #page scroller, so hand it the jump rather than
	// letting the browser fight it. Without Lenis (reduced motion) the native
	// anchor + scroll-margin-top does the job.
	const handleClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
		const lenis = lenisRef.current?.lenis;
		const target = document.getElementById(id);
		if (!lenis || !target) return;

		event.preventDefault();
		lenis.scrollTo(target, { offset: -Number.parseFloat(getComputedStyle(target).scrollMarginTop) });
		history.replaceState(null, '', `#${id}`);
	};

	// Render
	return (
		<nav className={className} aria-label='On this page'>
			<SpecialHeading text='On this page' tag='p' />
			<ol className={s.list}>
				{sections.map(({ id, title }, index) => (
					<li key={id}>
						<a href={`#${id}`} className={s.item} onClick={event => handleClick(event, id)}>
							<span className={s.number} data-type='captionL'>
								{String(index + 1).padStart(2, '0')}
							</span>
							<span className={s.title} data-type='bodyS'>
								{title}
							</span>
						</a>
					</li>
				))}
			</ol>
		</nav>
	);
};

// Exports
// ------------
Contents.displayName = 'Contents';
export default Contents;
