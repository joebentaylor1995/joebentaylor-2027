// Imports
// ------------
import SpecialHeading from '@parts/SpecialHeading';
import Link from 'next/link';
import { LEGAL_PAGES } from '../content';

// Styles + Interfaces
// ------------
import type * as I from '../interface';
import s from './styles.module.scss';

// Component
// ------------
const PageLinks = ({ current, className }: { current: I.LegalSlug; className?: string }) => {
	// Render
	return (
		<nav className={className} aria-label='Legal pages'>
			<SpecialHeading text='Legal' tag='p' />
			<ul className={s.links}>
				{LEGAL_PAGES.map(page => (
					<li key={page.slug}>
						<Link
							href={`/${page.slug}`}
							className={s.link}
							data-type='bodyM'
							aria-current={page.slug === current ? 'page' : undefined}
						>
							{page.label}
						</Link>
					</li>
				))}
			</ul>
		</nav>
	);
};

// Exports
// ------------
PageLinks.displayName = 'PageLinks';
export default PageLinks;
