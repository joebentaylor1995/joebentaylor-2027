'use client';

// Imports
// ------------

// Styles + Interfaces
// ------------
import s from './styles.module.scss';

// Component
// ------------
const SingleUSP = ({ children, href, linkLabel }: { children: React.ReactNode; href?: string; linkLabel?: string }) => {
	if (href)
		return (
			<a
				className={s.singleusp}
				href={href}
				target='_blank'
				rel='noopener noreferrer'
				data-cursor-link
				aria-label={linkLabel ? `${linkLabel} (opens in a new tab)` : undefined}
			>
				{children}
			</a>
		);
	return <div className={s.singleusp}>{children}</div>;
};

// Exports
// ------------
SingleUSP.displayName = 'SingleUSP';
export default SingleUSP;
