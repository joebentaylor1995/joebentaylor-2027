// Imports
// ------------
import PageTransition from '@parts/PageTransition';
import ProjectCaseBuilder from '@parts/ProjectCaseBuilder';
import ProjectExperience from '@parts/ProjectExperience';
import ProjectHero from '@parts/ProjectHero';
import ProjectOutro from '@parts/ProjectOutro';
import ProjectOverview from '@parts/ProjectOverview';
import { toMetadata } from '@utils/metadata';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { areProjectsVisible, getNextProject, getProject, getProjectSlugs } from '@/data/content';
import { projectDummy } from '@/data/projects';

// Types
// ------------
type Params = { params: Promise<{ slug: string }> };

// A cold case study must resolve before the transition captures its new view.
export const instant = false;

// Static Params
// ------------
// NOTE • Every published case study in Sanity (or the local fallback) is
// prerendered; new ones render on first request and are cached from then on
export const generateStaticParams = async () => (await getProjectSlugs()).map(slug => ({ slug }));

// SEO
// ------------
export const generateMetadata = async ({ params }: Params): Promise<Metadata> => {
	const { slug } = await params;
	const project = await getProject(slug);
	if (!project) return {};

	return {
		// NOTE • Never let dummy copy reach search results — fall back to the site description
		...toMetadata(project.seo, {
			title: project.title,
			description: project.description === projectDummy.description ? undefined : project.description,
		}),
		alternates: { canonical: `/projects/${slug}` },
	};
};

// Component
// ------------
const CaseStudy = async ({ params }: Params) => {
	// NOTE • A 404 until “Projects live” is on in Sanity (draft preview always sees it)
	if (!(await areProjectsVisible())) notFound();
	const { slug } = await params;
	const [project, nextProject] = await Promise.all([getProject(slug), getNextProject(slug)]);
	if (!project) notFound();

	return (
		<PageTransition>
			<ProjectExperience hero={<ProjectHero project={project} />}>
				<ProjectOverview overview={project.overview} />
				<ProjectCaseBuilder blocks={project.caseBuilder} />
				<ProjectOutro review={project.review} nextProject={nextProject} />
			</ProjectExperience>
		</PageTransition>
	);
};

// Keep the outgoing page until the complete case study can commit. A local
// empty Suspense fallback would be captured as the incoming transition image.
const Page = ({ params }: Params) => <CaseStudy params={params} />;

// Exports
// ------------
export default Page;
