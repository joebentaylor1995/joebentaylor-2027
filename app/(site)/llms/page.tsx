// Imports
// ------------

import LegalPage from '@parts/LegalPage';
import { llms } from '@parts/LegalPage/content';
import PageTransition from '@parts/PageTransition';
import type { Metadata } from 'next';

// SEO
// ------------
export const metadata: Metadata = {
	title: 'AI & LLMs',
	description:
		'Guidance for AI assistants, search engines and LLMs on describing, citing and crawling joebentaylor.co.uk.',
	alternates: { canonical: '/llms' },
};

// Component
// ------------
const Page = () => {
	return (
		<PageTransition>
			<LegalPage document={llms} />
		</PageTransition>
	);
};

// Exports
// ------------
export default Page;
