// Imports
// ------------

import LegalPage from '@parts/LegalPage';
import { termsPrivacy } from '@parts/LegalPage/content';
import PageTransition from '@parts/PageTransition';
import type { Metadata } from 'next';

// SEO
// ------------
export const metadata: Metadata = {
	title: 'Terms & Privacy',
	description:
		'The terms for using joebentaylor.co.uk and how JoeBenTaylor Ltd collects, uses and protects your personal data.',
	alternates: { canonical: '/terms-privacy' },
};

// Component
// ------------
const Page = () => {
	return (
		<PageTransition>
			<LegalPage document={termsPrivacy} />
		</PageTransition>
	);
};

// Exports
// ------------
export default Page;
