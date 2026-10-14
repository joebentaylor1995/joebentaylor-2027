// Imports
// ------------
import { connection } from 'next/server';
import { Suspense } from 'react';

// Styles + Interfaces
// ------------
import s from './styles.module.scss';

const YearDigits = ({ year, side }: { year: number; side: 'left' | 'right' }) => (
	<em data-type='bodyS' data-copyright-year={side}>
		<span className={s.yearText}>{year}</span>
		{Array.from(String(year).matchAll(/\d/g)).map(match => (
			<span className={s.digitClip} key={match.index} aria-hidden='true'>
				<span className={s.digit} data-copyright-digit>
					{match[0]}
				</span>
			</span>
		))}
	</em>
);

// The year changes per visit, so it waits until request time.
// The rest of the line stays in the prerendered shell.
const Year = async () => {
	await connection();

	return <YearDigits year={new Date().getFullYear()} side='right' />;
};

// Component
// ------------
const Copyright = () => {
	return (
		<div className={s.copyright} data-copyright>
			<YearDigits year={1995} side='left' />
			<span className={s.line} data-copyright-line='left' />
			<em data-type='bodyS' data-copyright-icon>
				&copy;
			</em>
			<span className={s.line} data-copyright-line='right' />
			<Suspense fallback={<em data-type='bodyS' />}>
				<Year />
			</Suspense>
		</div>
	);
};

// Exports
// ------------
Copyright.displayName = 'Copyright';
export default Copyright;
