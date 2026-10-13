// Imports
// ------------
import { connection } from 'next/server';
import { Suspense } from 'react';

// Styles + Interfaces
// ------------
import s from './styles.module.scss';

// The year changes per visit, so it waits until request time.
// The rest of the line stays in the prerendered shell.
const Year = async () => {
	await connection();

	return <em data-type='bodyS'>{new Date().getFullYear()}</em>;
};

// Component
// ------------
const Copyright = () => {
	return (
		<div className={s.copyright}>
			<em data-type='bodyS'>1995</em>
			<span />
			<em data-type='bodyS'>&copy;</em>
			<span />
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
