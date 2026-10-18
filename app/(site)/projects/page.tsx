// Imports
// ------------
import PageTransition from '@parts/PageTransition';
import ProjectsRibbon from '@parts/ProjectsRibbon';
import { toMetadata } from '@utils/metadata';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { areProjectsVisible, getProjectsPage } from '@/data/content';

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
// NOTE • A 404 until “Projects live” is on in Sanity (draft preview always sees it)
const Page = async () => {
	if (!(await areProjectsVisible())) notFound();

	return (
		<PageTransition>
			<Suspense fallback={null}>
				<ProjectsRibbon />
			</Suspense>
		</PageTransition>
	);
};

// Exports
// ------------
export default Page;
