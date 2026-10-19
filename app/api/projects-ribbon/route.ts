// Projects Ribbon — data
// ------------
// NOTE • Feeds the WebGL ribbon runtime (public/projects-ribbon) the featured
// and all-projects lists from Sanity's “Projects page” singleton, in the
// runtime's catalogue shape. Only published CMS projects are returned.

// Imports
// ------------
import { NextResponse } from 'next/server';
import { stegaClean } from 'next-sanity';
import { getProject, getProjectsPage } from '@/data/content';
import { PLACEHOLDER_IMAGE } from '@/data/site';

// Exports
// ------------
export const GET = async (request: Request) => {
	const slug = new URL(request.url).searchParams.get('project');
	if (slug) {
		const project = await getProject(slug);
		return project
			? NextResponse.json(
					stegaClean({ hero: project.hero.src, title: project.title, description: project.description })
				)
			: NextResponse.json({ error: 'Project not found' }, { status: 404 });
	}
	// SanityDevSync and the publish webhook invalidate this data on changes.
	// Reading the catalogue must not evict the routes we just prefetched.
	const { featured, all } = await getProjectsPage();

	// NOTE • placeholder lets the runtime swap in a stand-in for any poster that fails to load
	return NextResponse.json({ featured, all, placeholder: PLACEHOLDER_IMAGE });
};
