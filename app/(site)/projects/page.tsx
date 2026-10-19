// Imports
// ------------
import PageTransition from '@parts/PageTransition';
import { toMetadata } from '@utils/metadata';
import type { Metadata } from 'next';
import { getProjectsPage } from '@/data/content';

// SEO
// ------------
export const generateMetadata = async (): Promise<Metadata> => {
	const { seo } = await getProjectsPage();

	return {
		...toMetadata(seo, {
			title: 'Projects',
			description: 'Explore Joe Ben Taylor’s branding, website design and development projects.',
		}),
		alternates: { canonical: '/projects' },
	};
};

// Component
// ------------
const Page = () => (
	<PageTransition>
		<div data-projects-page />
	</PageTransition>
);

// Exports
// ------------
export default Page;
