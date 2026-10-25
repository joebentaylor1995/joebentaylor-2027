// Imports
// ------------
import ProjectModal from '@parts/ProjectModal';
import { getProject, getProjectSlugs, isModalCaseStudy } from '@/data/content';

// Types
// ------------
type Params = { params: Promise<{ slug: string }> };

// NOTE • Same as projects/[slug]: this slot renders alongside that page, and a segment
// still validated for instant navigation flags the whole route
export const instant = false;

// Static Params
// ------------
// NOTE • Mirrors projects/[slug] — slots at one segment level must render the same way
export const generateStaticParams = async () => (await getProjectSlugs()).map(slug => ({ slug }));

// Component
// ------------
// NOTE • Featured case studies keep their own hero page (projects/[slug]); every
// other case study renders here, into the profile panel
const Page = async ({ params }: Params) => {
	const { slug } = await params;
	const [project, isModal] = await Promise.all([getProject(slug), isModalCaseStudy(slug)]);
	return project && isModal ? <ProjectModal project={project} /> : null;
};

// Exports
// ------------
export default Page;
