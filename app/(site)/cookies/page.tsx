// Imports
// ------------

import LegalPage from '@parts/LegalPage';
import { cookies } from '@parts/LegalPage/content';
import PageTransition from '@parts/PageTransition';
import type { Metadata } from 'next';

// SEO
// ------------
export const metadata: Metadata = {
	title: 'Cookie Policy',
	description:
		'How joebentaylor.co.uk uses cookies and similar technologies, what each one does and how you can control them.',
	alternates: { canonical: '/cookies' },
};

// Component
// ------------
const Page = () => {
	return (
		<PageTransition>
			<LegalPage document={cookies} />
		</PageTransition>
	);
};

// Exports
// ------------
export default Page;
